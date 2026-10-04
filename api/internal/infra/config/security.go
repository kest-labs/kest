package config

import (
	"log"
	"strings"
)

// localDevelopmentEnvs are the APP_ENV values treated as local development.
// APP_ENV defaults to "development" when unset (see Load), so an unset
// APP_ENV is local development unless GIN_MODE says release.
var localDevelopmentEnvs = map[string]bool{
	"development": true,
	"dev":         true,
	"local":       true,
	"debug":       true,
	"testing":     true,
	"test":        true,
}

// IsLocalDevelopmentMode reports whether the given APP_ENV / GIN_MODE pair
// describes a local development or test run.
//
// The decision is intentionally conservative: any APP_ENV that is not a
// known development/test value (production, prod, staging, ...) or a
// GIN_MODE of release/prod/production is treated as production. Most
// deployment templates in this repository only set GIN_MODE=release, so
// GIN_MODE alone is enough to switch to production-safe defaults.
func IsLocalDevelopmentMode(appEnv, ginMode string) bool {
	switch strings.ToLower(strings.TrimSpace(ginMode)) {
	case "release", "prod", "production":
		return false
	}
	return localDevelopmentEnvs[strings.ToLower(strings.TrimSpace(appEnv))]
}

// IsLocalDevelopment reports whether this config describes a local
// development or test run (see IsLocalDevelopmentMode).
func (c *Config) IsLocalDevelopment() bool {
	return IsLocalDevelopmentMode(c.App.Env, c.Server.Mode)
}

// NormalizeCORS enforces a safe CORS configuration in place and returns
// human-readable warnings describing any adjustment.
//
// A wildcard origin ("*") must never be combined with credentials: browsers
// reject the combination and libraries that "fix" it by reflecting the
// request origin turn it into a credentialed any-origin policy. When "*" is
// present, the origin list collapses to just "*" and credentials are
// disabled. In production a wildcard additionally produces a loud warning.
func NormalizeCORS(c *CORSConfig, production bool) []string {
	wildcard := false
	for _, origin := range c.AllowOrigins {
		if strings.TrimSpace(origin) == "*" {
			wildcard = true
			break
		}
	}
	if !wildcard {
		return nil
	}

	var warnings []string
	c.AllowOrigins = []string{"*"}
	if c.AllowCredentials {
		c.AllowCredentials = false
		warnings = append(warnings,
			"CORS: CORS_ALLOW_ORIGINS contains '*', so credentials are disabled. "+
				"Set an explicit origin list (e.g. CORS_ALLOW_ORIGINS=https://app.example.com) to allow credentials.")
	}
	if production {
		warnings = append(warnings,
			"SECURITY WARNING: CORS_ALLOW_ORIGINS is '*' in production; any website can call this API from a browser. "+
				"Set CORS_ALLOW_ORIGINS to your frontend origin(s).")
	}
	return warnings
}

func logWarnings(warnings []string) {
	for _, w := range warnings {
		log.Printf("[config] %s", w)
	}
}
