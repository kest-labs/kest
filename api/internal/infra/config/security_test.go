package config

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func TestIsLocalDevelopmentMode(t *testing.T) {
	cases := []struct {
		appEnv, ginMode string
		want            bool
	}{
		{"development", "debug", true},
		{"local", "", true},
		{"test", "test", true},
		{"development", "release", false}, // GIN_MODE=release wins
		{"production", "debug", false},
		{"prod", "", false},
		{"staging", "debug", false}, // unknown env is production-safe
		{"", "debug", false},
	}
	for _, tc := range cases {
		if got := IsLocalDevelopmentMode(tc.appEnv, tc.ginMode); got != tc.want {
			t.Errorf("IsLocalDevelopmentMode(%q, %q) = %v, want %v", tc.appEnv, tc.ginMode, got, tc.want)
		}
	}
}

func TestNormalizeCORS_WildcardDisablesCredentials(t *testing.T) {
	c := CORSConfig{AllowOrigins: []string{"https://a.example", "*"}, AllowCredentials: true}
	warnings := NormalizeCORS(&c, false)

	if c.AllowCredentials {
		t.Fatal("credentials must be disabled when origins contain '*'")
	}
	if len(c.AllowOrigins) != 1 || c.AllowOrigins[0] != "*" {
		t.Fatalf("expected origins to collapse to [*], got %v", c.AllowOrigins)
	}
	if len(warnings) != 1 {
		t.Fatalf("expected 1 warning in development, got %v", warnings)
	}
}

func TestNormalizeCORS_WildcardInProductionWarnsLoudly(t *testing.T) {
	c := CORSConfig{AllowOrigins: []string{"*"}}
	warnings := NormalizeCORS(&c, true)
	if len(warnings) != 1 {
		t.Fatalf("expected a production warning, got %v", warnings)
	}
}

func TestNormalizeCORS_ExplicitOriginsUntouched(t *testing.T) {
	c := CORSConfig{AllowOrigins: []string{"https://app.example.com"}, AllowCredentials: true}
	if warnings := NormalizeCORS(&c, true); warnings != nil {
		t.Fatalf("unexpected warnings: %v", warnings)
	}
	if !c.AllowCredentials || c.AllowOrigins[0] != "https://app.example.com" {
		t.Fatalf("explicit config must be preserved, got %+v", c)
	}
}

// The server uses gin-contrib/cors; make sure a normalized wildcard config
// never emits Access-Control-Allow-Credentials.
func TestNormalizeCORS_GinContribNeverSendsCredentialsWithWildcard(t *testing.T) {
	gin.SetMode(gin.TestMode)
	c := CORSConfig{
		AllowOrigins:     []string{"*"},
		AllowMethods:     []string{"GET"},
		AllowHeaders:     []string{"Authorization"},
		AllowCredentials: true,
	}
	NormalizeCORS(&c, false)

	r := gin.New()
	r.Use(cors.New(cors.Config{
		AllowOrigins:     c.AllowOrigins,
		AllowMethods:     c.AllowMethods,
		AllowHeaders:     c.AllowHeaders,
		AllowCredentials: c.AllowCredentials,
	}))
	r.GET("/x", func(ctx *gin.Context) { ctx.Status(http.StatusOK) })

	req := httptest.NewRequest(http.MethodGet, "/x", nil)
	req.Header.Set("Origin", "https://evil.example")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if got := w.Header().Get("Access-Control-Allow-Origin"); got != "*" {
		t.Fatalf("expected ACAO '*', got %q", got)
	}
	if got := w.Header().Get("Access-Control-Allow-Credentials"); got != "" {
		t.Fatalf("expected no ACAC header with wildcard origin, got %q", got)
	}
}
