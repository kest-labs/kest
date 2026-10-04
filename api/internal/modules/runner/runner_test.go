package runner

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/kest-labs/kest/api/internal/infra/config"
	"github.com/kest-labs/kest/api/internal/modules/request"
)

func TestRun_TruncatesOversizedResponse(t *testing.T) {
	prev := config.GlobalConfig
	config.GlobalConfig = &config.Config{Runner: config.RunnerConfig{MaxResponseBytes: 8}}
	t.Cleanup(func() { config.GlobalConfig = prev })

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(strings.Repeat("x", 64)))
	}))
	defer srv.Close()

	r := &runner{client: srv.Client()}
	resp, err := r.Run(&request.Request{Method: http.MethodGet, URL: srv.URL}, nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !resp.Truncated || resp.Size != 8 || resp.Body != "xxxxxxxx" {
		t.Fatalf("expected 8-byte truncated body, got size=%d truncated=%v body=%q", resp.Size, resp.Truncated, resp.Body)
	}
}

func TestRun_SmallResponseNotTruncated(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte("ok"))
	}))
	defer srv.Close()

	r := &runner{client: srv.Client()}
	resp, err := r.Run(&request.Request{Method: http.MethodGet, URL: srv.URL}, nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.Truncated || resp.Body != "ok" {
		t.Fatalf("unexpected response: %+v", resp)
	}
}
