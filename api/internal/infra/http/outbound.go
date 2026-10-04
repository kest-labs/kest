package http

import (
	"errors"
	"fmt"
	"net"
	"net/http"
	"net/netip"
	"sync"
	"syscall"
	"time"

	"github.com/kest-labs/kest/api/internal/infra/config"
)

// ErrDestinationNotAllowed is returned (wrapped) when an outbound request
// would connect to a loopback, private, link-local or otherwise internal
// address while private networks are not allowed.
var ErrDestinationNotAllowed = errors.New("destination address is not allowed (set RUNNER_ALLOW_PRIVATE_NETWORKS=true to permit private/loopback targets)")

// Defaults for the outbound client used to execute user-supplied requests.
const (
	DefaultOutboundTimeout      = 30 * time.Second
	DefaultOutboundDialTimeout  = 10 * time.Second
	DefaultOutboundMaxRedirects = 10
)

// OutboundOptions configures a client that fetches user-supplied URLs.
type OutboundOptions struct {
	// AllowPrivateNetworks disables the destination IP checks.
	AllowPrivateNetworks bool
	// Timeout is the overall request timeout (including redirects and body).
	Timeout time.Duration
	// DialTimeout bounds TCP connection establishment.
	DialTimeout time.Duration
	// MaxRedirects is the maximum number of redirects followed.
	MaxRedirects int

	// deny overrides the address policy (tests only); nil uses IsDisallowedAddr.
	deny func(netip.AddrPort) bool
}

// DefaultOutboundOptions builds options from the loaded application config.
// Without a loaded config, private networks are blocked (fail closed).
func DefaultOutboundOptions() OutboundOptions {
	opts := OutboundOptions{
		Timeout:      DefaultOutboundTimeout,
		DialTimeout:  DefaultOutboundDialTimeout,
		MaxRedirects: DefaultOutboundMaxRedirects,
	}
	if cfg := config.GlobalConfig; cfg != nil {
		opts.AllowPrivateNetworks = cfg.Runner.AllowPrivateNetworks
		if cfg.Runner.MaxRedirects > 0 {
			opts.MaxRedirects = cfg.Runner.MaxRedirects
		}
	}
	return opts
}

var (
	sharedOutboundOnce   sync.Once
	sharedOutboundClient *http.Client
)

// SharedOutboundClient returns the process-wide client used by the request
// runner, flow runner and test runner. It is created lazily on first use so
// that it observes the loaded configuration.
func SharedOutboundClient() *http.Client {
	sharedOutboundOnce.Do(func() {
		sharedOutboundClient = NewOutboundClient(DefaultOutboundOptions())
	})
	return sharedOutboundClient
}

// NewOutboundClient creates an HTTP client for fetching untrusted URLs.
//
// Unless AllowPrivateNetworks is set, every connection (including each
// redirect hop) is checked at dial time against the *resolved* IP address,
// which defeats DNS rebinding: the address validated is exactly the address
// connected to. Environment proxies are ignored in that mode because a proxy
// would make the dial-time check see the proxy's address, not the target's.
func NewOutboundClient(opts OutboundOptions) *http.Client {
	if opts.Timeout <= 0 {
		opts.Timeout = DefaultOutboundTimeout
	}
	if opts.DialTimeout <= 0 {
		opts.DialTimeout = DefaultOutboundDialTimeout
	}
	if opts.MaxRedirects <= 0 {
		opts.MaxRedirects = DefaultOutboundMaxRedirects
	}

	dialer := &net.Dialer{
		Timeout:   opts.DialTimeout,
		KeepAlive: 30 * time.Second,
	}
	proxy := http.ProxyFromEnvironment
	if !opts.AllowPrivateNetworks {
		deny := opts.deny
		if deny == nil {
			deny = func(ap netip.AddrPort) bool { return IsDisallowedAddr(ap.Addr()) }
		}
		dialer.Control = denyControl(deny)
		proxy = nil
	}

	transport := &http.Transport{
		Proxy:                 proxy,
		DialContext:           dialer.DialContext,
		ForceAttemptHTTP2:     true,
		MaxIdleConns:          100,
		IdleConnTimeout:       90 * time.Second,
		TLSHandshakeTimeout:   10 * time.Second,
		ExpectContinueTimeout: 1 * time.Second,
	}

	maxRedirects := opts.MaxRedirects
	return &http.Client{
		Timeout:   opts.Timeout,
		Transport: transport,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if len(via) > maxRedirects {
				return fmt.Errorf("stopped after %d redirects", maxRedirects)
			}
			if req.URL.Scheme != "http" && req.URL.Scheme != "https" {
				return fmt.Errorf("redirect to unsupported scheme %q", req.URL.Scheme)
			}
			// The destination of every hop is re-validated by the dialer.
			return nil
		},
	}
}

// denyControl returns a net.Dialer Control hook. Control runs after DNS
// resolution, right before connect(2), with the literal IP:port being dialed.
func denyControl(deny func(netip.AddrPort) bool) func(string, string, syscall.RawConn) error {
	return func(_ string, address string, _ syscall.RawConn) error {
		ap, err := netip.ParseAddrPort(address)
		if err != nil || deny(ap) {
			return fmt.Errorf("%w: %s", ErrDestinationNotAllowed, address)
		}
		return nil
	}
}

var blockedPrefixes = mustPrefixes(
	"0.0.0.0/8",       // "this network"
	"100.64.0.0/10",   // carrier-grade NAT
	"192.0.0.0/24",    // IETF protocol assignments
	"192.0.2.0/24",    // TEST-NET-1
	"198.18.0.0/15",   // benchmarking
	"198.51.100.0/24", // TEST-NET-2
	"203.0.113.0/24",  // TEST-NET-3
	"240.0.0.0/4",     // reserved, includes 255.255.255.255
	"100::/64",        // IPv6 discard-only
	"64:ff9b:1::/48",  // local-use NAT64 (internal by definition)
	"2001::/32",       // Teredo (embedded IPv4 is obfuscated; block entirely)
	"2001:db8::/32",   // IPv6 documentation
)

var (
	nat64Prefix     = netip.MustParsePrefix("64:ff9b::/96")
	sixToFourPrefix = netip.MustParsePrefix("2002::/16")
)

// IsDisallowedIP reports whether ip must not be reached by outbound requests
// when private networks are not allowed.
func IsDisallowedIP(ip net.IP) bool {
	addr, ok := netip.AddrFromSlice(ip)
	if !ok {
		return true
	}
	return IsDisallowedAddr(addr)
}

// IsDisallowedAddr reports whether addr is loopback, private (RFC 1918 /
// unique-local), link-local (incl. 169.254.169.254 metadata), CGNAT,
// unspecified, multicast, reserved, or an IPv6 transition address embedding
// one of those.
func IsDisallowedAddr(addr netip.Addr) bool {
	if !addr.IsValid() {
		return true
	}
	addr = addr.Unmap() // ::ffff:127.0.0.1 -> 127.0.0.1
	if addr.Zone() != "" {
		return true // scoped (link-local) IPv6
	}

	if addr.IsLoopback() ||
		addr.IsPrivate() ||
		addr.IsLinkLocalUnicast() ||
		addr.IsLinkLocalMulticast() ||
		addr.IsInterfaceLocalMulticast() ||
		addr.IsMulticast() ||
		addr.IsUnspecified() {
		return true
	}

	for _, p := range blockedPrefixes {
		if p.Contains(addr) {
			return true
		}
	}

	if addr.Is6() {
		b := addr.As16()
		switch {
		case nat64Prefix.Contains(addr):
			return IsDisallowedAddr(netip.AddrFrom4([4]byte{b[12], b[13], b[14], b[15]}))
		case sixToFourPrefix.Contains(addr):
			return IsDisallowedAddr(netip.AddrFrom4([4]byte{b[2], b[3], b[4], b[5]}))
		}
	}
	return false
}

func mustPrefixes(cidrs ...string) []netip.Prefix {
	out := make([]netip.Prefix, 0, len(cidrs))
	for _, c := range cidrs {
		out = append(out, netip.MustParsePrefix(c))
	}
	return out
}
