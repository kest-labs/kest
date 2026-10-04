package http

import (
	"errors"
	"net"
	"net/http"
	"net/http/httptest"
	"net/netip"
	"net/url"
	"strings"
	"sync/atomic"
	"testing"
)

func TestIsDisallowedAddr(t *testing.T) {
	blocked := []string{
		"127.0.0.1", "127.255.255.254", // loopback
		"10.0.0.1", "172.16.0.1", "172.31.255.255", "192.168.1.1", // RFC 1918
		"169.254.169.254", "169.254.0.1", // link-local / cloud metadata
		"100.64.0.1", "100.127.255.254", // CGNAT
		"0.0.0.0", "0.1.2.3", // unspecified / this-network
		"224.0.0.1", "239.255.255.250", // multicast
		"255.255.255.255", "240.0.0.1", // reserved / broadcast
		"192.0.2.1", "198.18.0.1", // documentation / benchmarking
		"::1", "::", // IPv6 loopback / unspecified
		"fc00::1", "fd12:3456::1", // unique local
		"fe80::1", "ff02::1", // link-local / multicast
		"::ffff:127.0.0.1", "::ffff:169.254.169.254", "::ffff:10.0.0.1", // v4-mapped
		"64:ff9b::a9fe:a9fe", "64:ff9b::7f00:1", // NAT64 embedding internal v4
		"64:ff9b:1::1",        // local-use NAT64
		"2002:7f00:1::1",      // 6to4 embedding 127.0.0.1
		"2002:a9fe:a9fe::1",   // 6to4 embedding 169.254.169.254
		"2001:db8::1",         // documentation
		"2001:0:4136:e378::1", // Teredo
	}
	for _, s := range blocked {
		if !IsDisallowedAddr(netip.MustParseAddr(s)) {
			t.Errorf("expected %s to be blocked", s)
		}
	}

	allowed := []string{
		"8.8.8.8", "1.1.1.1", "93.184.216.34", "172.32.0.1", "100.128.0.1",
		"2606:4700:4700::1111", "2a00:1450:4001:80b::200e",
		"::ffff:8.8.8.8",
		"64:ff9b::808:808", // NAT64 embedding 8.8.8.8
		"2002:808:808::1",  // 6to4 embedding 8.8.8.8
	}
	for _, s := range allowed {
		if IsDisallowedAddr(netip.MustParseAddr(s)) {
			t.Errorf("expected %s to be allowed", s)
		}
	}

	if !IsDisallowedIP(net.ParseIP("169.254.169.254")) || IsDisallowedIP(net.ParseIP("8.8.8.8")) {
		t.Error("IsDisallowedIP must agree with IsDisallowedAddr")
	}
	if !IsDisallowedIP(nil) {
		t.Error("invalid IP must be blocked")
	}
}

func TestOutboundClient_BlocksLoopbackByIPAndHostname(t *testing.T) {
	var hits int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&hits, 1)
	}))
	defer srv.Close()

	client := NewOutboundClient(OutboundOptions{})

	u, _ := url.Parse(srv.URL)
	targets := []string{
		srv.URL,                        // http://127.0.0.1:port
		"http://localhost:" + u.Port(), // resolved at dial time
	}
	for _, target := range targets {
		resp, err := client.Get(target)
		if err == nil {
			resp.Body.Close()
			t.Fatalf("expected %s to be blocked", target)
		}
		if !errors.Is(err, ErrDestinationNotAllowed) {
			t.Fatalf("expected ErrDestinationNotAllowed for %s, got %v", target, err)
		}
	}
	if atomic.LoadInt32(&hits) != 0 {
		t.Fatal("blocked target must never receive a request")
	}
}

func TestOutboundClient_AllowPrivateNetworks(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte("ok"))
	}))
	defer srv.Close()

	client := NewOutboundClient(OutboundOptions{AllowPrivateNetworks: true})
	resp, err := client.Get(srv.URL)
	if err != nil {
		t.Fatalf("expected loopback to be allowed, got %v", err)
	}
	resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("unexpected status %d", resp.StatusCode)
	}
}

// A permitted host redirecting to an internal address must be stopped: every
// hop is dialed (and therefore validated) again.
func TestOutboundClient_RedirectToPrivateTargetIsBlocked(t *testing.T) {
	var internalHits int32
	internal := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&internalHits, 1)
	}))
	defer internal.Close()

	public := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, internal.URL+"/latest/meta-data", http.StatusFound)
	}))
	defer public.Close()

	internalAP := netip.MustParseAddrPort(strings.TrimPrefix(internal.URL, "http://"))
	client := NewOutboundClient(OutboundOptions{
		// Treat only the "internal" server as private; the "public" one is
		// reachable so the redirect itself is followed.
		deny: func(ap netip.AddrPort) bool { return ap.Port() == internalAP.Port() },
	})

	resp, err := client.Get(public.URL)
	if err == nil {
		resp.Body.Close()
		t.Fatal("expected redirect to internal target to fail")
	}
	if !errors.Is(err, ErrDestinationNotAllowed) {
		t.Fatalf("expected ErrDestinationNotAllowed, got %v", err)
	}
	if atomic.LoadInt32(&internalHits) != 0 {
		t.Fatal("internal target must never receive a request")
	}
}

func TestOutboundClient_RedirectLimit(t *testing.T) {
	var hits int32
	var srv *httptest.Server
	srv = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&hits, 1)
		http.Redirect(w, r, srv.URL, http.StatusFound)
	}))
	defer srv.Close()

	client := NewOutboundClient(OutboundOptions{AllowPrivateNetworks: true, MaxRedirects: 3})
	resp, err := client.Get(srv.URL)
	if err == nil {
		resp.Body.Close()
		t.Fatal("expected redirect loop to be stopped")
	}
	if !strings.Contains(err.Error(), "stopped after 3 redirects") {
		t.Fatalf("unexpected error: %v", err)
	}
	if got := atomic.LoadInt32(&hits); got != 4 {
		t.Fatalf("expected 4 requests (1 + 3 redirects), got %d", got)
	}
}
