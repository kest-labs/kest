package middleware

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/kest-labs/kest/api/internal/infra/config"
)

func newRateLimitedEngine(rl config.RateLimitConfig) *gin.Engine {
	r := gin.New()
	r.Use(RateLimiters(&config.Config{RateLimit: rl})...)
	ok := func(c *gin.Context) { c.Status(http.StatusOK) }
	r.POST("/v1/login", ok)
	r.GET("/v1/health", ok)
	r.POST("/v1/workspaces/:id/collections/:cid/requests/:rid/run", ok)
	r.GET("/v1/workspaces/:id/flows/:fid/runs/:rid/events", ok)
	return r
}

func doRequest(r http.Handler, method, path, ip string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, path, nil)
	req.RemoteAddr = ip + ":12345"
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

func TestRateLimiters_AuthEndpointReturns429WithRetryAfter(t *testing.T) {
	r := newRateLimitedEngine(config.RateLimitConfig{
		Enabled: true, Store: "memory",
		AuthMax: 2, AuthWindow: time.Minute,
	})

	for i := 0; i < 2; i++ {
		if w := doRequest(r, http.MethodPost, "/v1/login", "203.0.113.7"); w.Code != http.StatusOK {
			t.Fatalf("request %d: expected 200, got %d", i+1, w.Code)
		}
	}

	w := doRequest(r, http.MethodPost, "/v1/login", "203.0.113.7")
	if w.Code != http.StatusTooManyRequests {
		t.Fatalf("expected 429, got %d", w.Code)
	}
	retryAfter, err := strconv.Atoi(w.Header().Get("Retry-After"))
	if err != nil || retryAfter < 1 || retryAfter > 60 {
		t.Fatalf("expected Retry-After in [1,60], got %q", w.Header().Get("Retry-After"))
	}

	var body struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("expected JSON error body: %v", err)
	}
	if body.Code != http.StatusTooManyRequests || body.Message == "" {
		t.Fatalf("unexpected error body: %s", w.Body.String())
	}

	// A different IP has its own budget; unrelated routes are not limited.
	if w := doRequest(r, http.MethodPost, "/v1/login", "198.51.100.9"); w.Code != http.StatusOK {
		t.Fatalf("other IP should not be limited, got %d", w.Code)
	}
	for i := 0; i < 5; i++ {
		if w := doRequest(r, http.MethodGet, "/v1/health", "203.0.113.7"); w.Code != http.StatusOK {
			t.Fatalf("health must not be rate limited, got %d", w.Code)
		}
	}
}

func TestRateLimiters_RunEndpoints(t *testing.T) {
	r := newRateLimitedEngine(config.RateLimitConfig{
		Enabled: true, Store: "memory",
		RunMax: 1, RunWindow: time.Minute,
	})

	path := "/v1/workspaces/1/collections/2/requests/3/run"
	if w := doRequest(r, http.MethodPost, path, "203.0.113.8"); w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	if w := doRequest(r, http.MethodPost, path, "203.0.113.8"); w.Code != http.StatusTooManyRequests {
		t.Fatalf("expected 429, got %d", w.Code)
	}
	// The run budget is shared across run endpoints for the same caller.
	if w := doRequest(r, http.MethodGet, "/v1/workspaces/1/flows/2/runs/3/events", "203.0.113.8"); w.Code != http.StatusTooManyRequests {
		t.Fatalf("expected 429 on flow run events, got %d", w.Code)
	}
}

func TestRateLimiters_Disabled(t *testing.T) {
	if got := RateLimiters(&config.Config{RateLimit: config.RateLimitConfig{Enabled: false, AuthMax: 1, AuthWindow: time.Minute}}); len(got) != 0 {
		t.Fatalf("expected no middleware when disabled, got %d", len(got))
	}
}

func TestRouteMatchers(t *testing.T) {
	authCases := map[string]bool{
		"POST /v1/login":                     true,
		"POST /v1/register":                  true,
		"POST /v1/password/reset":            true,
		"POST /v1/workspaces/:id/cli-tokens": true,
		"GET /v1/workspaces/:id/cli-tokens":  false,
		"GET /v1/users/profile":              false,
	}
	for in, want := range authCases {
		method, path := splitCase(in)
		if got := IsAuthRateLimitedRoute(method, path); got != want {
			t.Errorf("IsAuthRateLimitedRoute(%s) = %v, want %v", in, got, want)
		}
	}

	runCases := map[string]bool{
		"POST /v1/workspaces/:id/collections/:cid/requests/:rid/run": true,
		"POST /v1/workspaces/:id/flows/:fid/run":                     true,
		"POST /v1/workspaces/:id/test-cases/:tcid/run":               true,
		"GET /v1/workspaces/:id/flows/:fid/runs/:rid/events":         true,
		"GET /v1/workspaces/:id/flows/:fid/runs":                     false,
		"POST /v1/workspaces/:id/flows":                              false,
	}
	for in, want := range runCases {
		method, path := splitCase(in)
		if got := IsRunRateLimitedRoute(method, path); got != want {
			t.Errorf("IsRunRateLimitedRoute(%s) = %v, want %v", in, got, want)
		}
	}
}

func splitCase(s string) (string, string) {
	method, path, _ := strings.Cut(s, " ")
	return method, path
}
