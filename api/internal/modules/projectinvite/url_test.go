package projectinvite

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/kest-labs/kest/api/internal/infra/config"
)

func TestResolveInvitationBaseURLPrefersForwardedHeaders(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "https://api.kest.dev/v1/projects/60/invitations", nil)
	req.Header.Set("X-Forwarded-Proto", "https")
	req.Header.Set("X-Forwarded-Host", "www.kest.run")

	if got := resolveInvitationBaseURL(req); got != "https://www.kest.run" {
		t.Fatalf("expected forwarded base URL, got %q", got)
	}
}

func TestResolveInvitationBaseURLFallsBackToForwardedHeader(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "http://api.kest.dev/v1/projects/60/invitations", nil)
	req.Header.Set("Forwarded", `for=203.0.113.10;proto=https;host=members.kest.run`)

	if got := resolveInvitationBaseURL(req); got != "https://members.kest.run" {
		t.Fatalf("expected Forwarded header base URL, got %q", got)
	}
}

func TestResolveInvitationBaseURLFallsBackToRequestHost(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "https://api.kest.dev/v1/projects/60/invitations", nil)

	if got := resolveInvitationBaseURL(req); got != "https://api.kest.dev" {
		t.Fatalf("expected request host base URL, got %q", got)
	}
}

func TestBuildProjectInvitationURLForBase(t *testing.T) {
	got := buildProjectInvitationURLForBase("pji_demo", "https://www.kest.run/")

	if got != "https://www.kest.run/invite/project/pji_demo" {
		t.Fatalf("unexpected invite URL %q", got)
	}
}

func TestBuildProjectInvitationURLForBasePrefersConfiguredAppURL(t *testing.T) {
	previous := config.GlobalConfig
	config.GlobalConfig = &config.Config{
		App: config.AppConfig{
			FrontendURL: "https://kest.run",
		},
	}
	defer func() {
		config.GlobalConfig = previous
	}()

	got := buildProjectInvitationURLForBase("pji_demo", "http://localhost:3000")

	if got != "https://kest.run/invite/project/pji_demo" {
		t.Fatalf("expected configured frontend URL, got %q", got)
	}
}

func TestBuildProjectInvitationURLForBaseIgnoresLoopbackRequestBase(t *testing.T) {
	previous := config.GlobalConfig
	config.GlobalConfig = nil
	defer func() {
		config.GlobalConfig = previous
	}()

	got := buildProjectInvitationURLForBase("pji_demo", "http://127.0.0.1:3000")

	if got != "/invite/project/pji_demo" {
		t.Fatalf("expected relative path fallback, got %q", got)
	}
}
