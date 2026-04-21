package projectinvite

import (
	"fmt"
	"net"
	"net/http"
	neturl "net/url"
	"strings"

	"github.com/kest-labs/kest/api/internal/infra/config"
)

func resolveInvitationBaseURL(r *http.Request) string {
	if r == nil {
		return ""
	}

	forwarded := strings.TrimSpace(r.Header.Get("Forwarded"))
	scheme := firstForwardedValue(r.Header.Get("X-Forwarded-Proto"))
	if scheme == "" {
		scheme = forwardedDirectiveValue(forwarded, "proto")
	}

	host := firstForwardedValue(r.Header.Get("X-Forwarded-Host"))
	if host == "" {
		host = forwardedDirectiveValue(forwarded, "host")
	}
	if host == "" {
		host = strings.TrimSpace(r.Host)
	}
	if host == "" {
		return ""
	}

	if scheme == "" {
		if r.TLS != nil {
			scheme = "https"
		} else {
			scheme = "http"
		}
	}

	return fmt.Sprintf("%s://%s", scheme, host)
}

func resolveConfiguredInvitationBaseURL() string {
	if config.GlobalConfig == nil {
		return ""
	}

	return normalizeInvitationBaseURL(config.GlobalConfig.App.FrontendURL, false)
}

func normalizeInvitationBaseURL(raw string, allowLoopback bool) string {
	trimmed := strings.TrimRight(strings.TrimSpace(raw), "/")
	if trimmed == "" {
		return ""
	}

	parsed, err := neturl.Parse(trimmed)
	if err != nil || parsed.Scheme == "" || parsed.Host == "" {
		return ""
	}

	hostname := strings.TrimSpace(parsed.Hostname())
	if hostname == "" {
		return ""
	}
	if !allowLoopback && isLoopbackHostname(hostname) {
		return ""
	}

	return fmt.Sprintf("%s://%s", parsed.Scheme, parsed.Host)
}

func isLoopbackHostname(hostname string) bool {
	normalized := strings.TrimSpace(strings.ToLower(hostname))
	if normalized == "" {
		return false
	}
	if normalized == "localhost" || strings.HasSuffix(normalized, ".localhost") {
		return true
	}
	if ip := net.ParseIP(normalized); ip != nil {
		return ip.IsLoopback() || ip.IsUnspecified()
	}

	return false
}

func firstForwardedValue(raw string) string {
	if raw == "" {
		return ""
	}

	first := strings.TrimSpace(strings.Split(raw, ",")[0])
	return strings.Trim(first, "\"")
}

func forwardedDirectiveValue(raw, key string) string {
	if raw == "" {
		return ""
	}

	first := strings.TrimSpace(strings.Split(raw, ",")[0])
	for _, part := range strings.Split(first, ";") {
		part = strings.TrimSpace(part)
		name, value, ok := strings.Cut(part, "=")
		if !ok || !strings.EqualFold(strings.TrimSpace(name), key) {
			continue
		}
		return strings.Trim(strings.TrimSpace(value), "\"")
	}

	return ""
}
