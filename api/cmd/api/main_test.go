package main

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"

	"github.com/kest-labs/kest/api/internal/app"
	"github.com/kest-labs/kest/api/internal/infra/config"
)

// newTestRouter builds the production router through the same constructor as
// main, with a deliberately tiny rate limit so the test stays fast.
func newTestRouter(t *testing.T, env map[string]string) *gin.Engine {
	t.Helper()
	gin.SetMode(gin.TestMode)
	t.Setenv("DB_PASSWORD", "x")
	t.Setenv("DB_USERNAME", "x")
	t.Setenv("JWT_SECRET", "test-secret-0123456789abcdef0123")
	for k, v := range env {
		t.Setenv(k, v)
	}
	cfg, err := config.Load()
	if err != nil {
		t.Fatalf("config.Load: %v", err)
	}
	return newRouter(cfg, &app.Handlers{})
}

func do(r http.Handler, method, path string, headers map[string]string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, path, strings.NewReader("{}"))
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

// Regression: cmd/api/main.go once built its engine without CORS or rate
// limiting, so neither was active in production builds.
func TestNewRouterAppliesCORS(t *testing.T) {
	r := newTestRouter(t, map[string]string{"CORS_ALLOW_ORIGINS": "https://app.kest.test"})

	allowed := do(r, http.MethodOptions, "/v1/login", map[string]string{
		"Origin": "https://app.kest.test", "Access-Control-Request-Method": "POST",
	})
	if got := allowed.Header().Get("Access-Control-Allow-Origin"); got != "https://app.kest.test" {
		t.Fatalf("allowed origin header = %q (status %d)", got, allowed.Code)
	}

	denied := do(r, http.MethodOptions, "/v1/login", map[string]string{
		"Origin": "https://evil.example", "Access-Control-Request-Method": "POST",
	})
	if got := denied.Header().Get("Access-Control-Allow-Origin"); got != "" {
		t.Fatalf("disallowed origin was allowed: %q", got)
	}
}

func TestNewRouterRateLimitsLogin(t *testing.T) {
	r := newTestRouter(t, map[string]string{
		"RATE_LIMIT_ENABLED": "true", "RATE_LIMIT_STORE": "memory",
		"RATE_LIMIT_AUTH_MAX": "3", "RATE_LIMIT_AUTH_WINDOW": "1m",
	})
	// Handlers are empty here, so register a stand-in for the login route.
	r.POST("/v1/login", func(c *gin.Context) { c.Status(http.StatusUnauthorized) })
	var last *httptest.ResponseRecorder
	for i := 0; i < 5; i++ {
		last = do(r, http.MethodPost, "/v1/login", nil)
	}
	if last.Code != http.StatusTooManyRequests {
		t.Fatalf("5th login attempt status = %d, want 429", last.Code)
	}
	if last.Header().Get("Retry-After") == "" {
		t.Fatal("429 response has no Retry-After header")
	}
}
