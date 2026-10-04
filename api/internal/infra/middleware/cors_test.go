package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func init() {
	gin.SetMode(gin.TestMode)
}

func TestCORS_AllowAll(t *testing.T) {
	router := gin.New()
	router.Use(CORSWithConfig(CORSConfig{
		AllowOrigins: []string{"*"},
	}))
	router.GET("/test", func(c *gin.Context) {
		c.String(200, "ok")
	})

	req := httptest.NewRequest("GET", "/test", nil)
	req.Header.Set("Origin", "http://example.com")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Header().Get("Access-Control-Allow-Origin") != "*" {
		t.Errorf("Expected Access-Control-Allow-Origin to be *, got %s", w.Header().Get("Access-Control-Allow-Origin"))
	}
}

func TestCORS_WildcardNeverSendsCredentials(t *testing.T) {
	if DefaultCORSConfig().AllowCredentials {
		t.Fatal("DefaultCORSConfig must not combine '*' with credentials")
	}

	router := gin.New()
	router.Use(CORSWithConfig(CORSConfig{
		AllowOrigins:     []string{"*"},
		AllowCredentials: true,
	}))
	router.GET("/test", func(c *gin.Context) {
		c.String(200, "ok")
	})

	req := httptest.NewRequest("GET", "/test", nil)
	req.Header.Set("Origin", "http://evil.example")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if got := w.Header().Get("Access-Control-Allow-Origin"); got != "*" {
		t.Errorf("expected '*' (never a reflected origin), got %q", got)
	}
	if got := w.Header().Get("Access-Control-Allow-Credentials"); got != "" {
		t.Errorf("expected no credentials header with wildcard, got %q", got)
	}
}

func TestCORS_SpecificOrigin(t *testing.T) {
	router := gin.New()
	router.Use(CORSWithConfig(CORSConfig{
		AllowOrigins:     []string{"http://localhost:3000", "http://example.com"},
		AllowCredentials: true,
	}))
	router.GET("/test", func(c *gin.Context) {
		c.String(200, "ok")
	})

	// Test allowed origin
	req := httptest.NewRequest("GET", "/test", nil)
	req.Header.Set("Origin", "http://localhost:3000")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Header().Get("Access-Control-Allow-Origin") != "http://localhost:3000" {
		t.Errorf("Expected specific origin, got %s", w.Header().Get("Access-Control-Allow-Origin"))
	}
	if w.Header().Get("Access-Control-Allow-Credentials") != "true" {
		t.Error("Expected credentials header")
	}
}

func TestCORS_UnallowedOrigin(t *testing.T) {
	router := gin.New()
	router.Use(CORSWithConfig(CORSConfig{
		AllowOrigins: []string{"http://localhost:3000"},
	}))
	router.GET("/test", func(c *gin.Context) {
		c.String(200, "ok")
	})

	req := httptest.NewRequest("GET", "/test", nil)
	req.Header.Set("Origin", "http://evil.com")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Header().Get("Access-Control-Allow-Origin") != "" {
		t.Errorf("Expected no CORS header for unallowed origin, got %s", w.Header().Get("Access-Control-Allow-Origin"))
	}
}

func TestCORS_Preflight(t *testing.T) {
	router := gin.New()
	router.Use(CORSWithConfig(CORSConfig{
		AllowOrigins: []string{"http://localhost:3000"},
		AllowMethods: []string{"GET", "POST", "PUT"},
		AllowHeaders: []string{"Content-Type", "Authorization"},
	}))
	router.OPTIONS("/test", func(c *gin.Context) {})

	req := httptest.NewRequest("OPTIONS", "/test", nil)
	req.Header.Set("Origin", "http://localhost:3000")
	req.Header.Set("Access-Control-Request-Method", "POST")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusNoContent {
		t.Errorf("Expected 204, got %d", w.Code)
	}
	if w.Header().Get("Access-Control-Allow-Methods") == "" {
		t.Error("Expected Access-Control-Allow-Methods header")
	}
}

func TestCORS_NoOrigin(t *testing.T) {
	router := gin.New()
	router.Use(CORSWithConfig(DefaultCORSConfig()))
	router.GET("/test", func(c *gin.Context) {
		c.String(200, "ok")
	})

	req := httptest.NewRequest("GET", "/test", nil)
	// No Origin header
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Header().Get("Access-Control-Allow-Origin") != "" {
		t.Error("Expected no CORS header when no Origin")
	}
	if w.Code != 200 {
		t.Errorf("Expected 200, got %d", w.Code)
	}
}

func TestCORS_CaseInsensitive(t *testing.T) {
	router := gin.New()
	router.Use(CORSWithConfig(CORSConfig{
		AllowOrigins: []string{"http://LOCALHOST:3000"},
	}))
	router.GET("/test", func(c *gin.Context) {
		c.String(200, "ok")
	})

	req := httptest.NewRequest("GET", "/test", nil)
	req.Header.Set("Origin", "http://localhost:3000")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// Should match case-insensitively but return original
	if w.Header().Get("Access-Control-Allow-Origin") != "http://localhost:3000" {
		t.Errorf("Expected case-insensitive match, got %s", w.Header().Get("Access-Control-Allow-Origin"))
	}
}

func TestCORS_WildcardLocalhost(t *testing.T) {
	router := gin.New()
	router.Use(CORSWithConfig(CORSConfig{
		AllowOrigins:     []string{"http://localhost:*"},
		AllowCredentials: true,
	}))
	router.GET("/test", func(c *gin.Context) {
		c.String(200, "ok")
	})

	// Test various localhost ports
	testCases := []struct {
		origin   string
		expected bool
	}{
		{"http://localhost:3000", true},
		{"http://localhost:3001", true},
		{"http://localhost:5173", true},
		{"http://localhost:8080", true},
		{"http://localhost:80", true},
		{"https://localhost:3000", false}, // https != http
		{"http://example.com:3000", false},
	}

	for _, tc := range testCases {
		req := httptest.NewRequest("GET", "/test", nil)
		req.Header.Set("Origin", tc.origin)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		got := w.Header().Get("Access-Control-Allow-Origin")
		if tc.expected && got != tc.origin {
			t.Errorf("Origin %s: expected %s, got %s", tc.origin, tc.origin, got)
		}
		if !tc.expected && got != "" {
			t.Errorf("Origin %s: expected empty, got %s", tc.origin, got)
		}
	}
}

func TestCORS_WildcardSubdomain(t *testing.T) {
	router := gin.New()
	router.Use(CORSWithConfig(CORSConfig{
		AllowOrigins:     []string{"https://*.example.com"},
		AllowCredentials: true,
	}))
	router.GET("/test", func(c *gin.Context) {
		c.String(200, "ok")
	})

	// Test various subdomains
	testCases := []struct {
		origin   string
		expected bool
	}{
		{"https://app.example.com", true},
		{"https://admin.example.com", true},
		{"https://api.example.com", true},
		{"https://sub.domain.example.com", true},
		{"https://example.com", false},    // no subdomain
		{"http://app.example.com", false}, // http != https
		{"https://app.evil.com", false},
	}

	for _, tc := range testCases {
		req := httptest.NewRequest("GET", "/test", nil)
		req.Header.Set("Origin", tc.origin)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		got := w.Header().Get("Access-Control-Allow-Origin")
		if tc.expected && got != tc.origin {
			t.Errorf("Origin %s: expected %s, got %s", tc.origin, tc.origin, got)
		}
		if !tc.expected && got != "" {
			t.Errorf("Origin %s: expected empty, got %s", tc.origin, got)
		}
	}
}
