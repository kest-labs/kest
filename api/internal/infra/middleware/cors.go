package middleware

import (
	"net/http"
	"regexp"
	"strings"

	"github.com/kest-labs/kest/api/internal/infra/config"
	"github.com/gin-gonic/gin"
)

// CORSConfig holds CORS middleware configuration
type CORSConfig struct {
	// AllowOrigins is a list of origins a cross-domain request can be executed from
	// Supports wildcards: "http://localhost:*", "https://*.example.com"
	// Default: ["*"]
	AllowOrigins []string

	// AllowMethods is a list of methods the client is allowed to use
	// Default: ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
	AllowMethods []string

	// AllowHeaders is a list of headers the client is allowed to use
	// Default: ["Origin", "Content-Type", "Accept", "Authorization"]
	AllowHeaders []string

	// ExposeHeaders is a list of headers exposed to the client
	// Default: ["Content-Length"]
	ExposeHeaders []string

	// AllowCredentials indicates whether the request can include user credentials
	// Default: true
	AllowCredentials bool

	// MaxAge indicates how long (in seconds) the results of a preflight request can be cached
	// Default: 86400 (24 hours)
	MaxAge int
}

// originMatcher holds compiled patterns for origin matching
type originMatcher struct {
	exact    map[string]bool
	patterns []*regexp.Regexp
	allowAll bool
}

// DefaultCORSConfig returns default CORS configuration
func DefaultCORSConfig() CORSConfig {
	return CORSConfig{
		AllowOrigins:     []string{"*"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization", "X-Requested-With"},
		ExposeHeaders:    []string{"Content-Length", "Content-Type"},
		AllowCredentials: true,
		MaxAge:           86400,
	}
}

// CORS returns CORS middleware using global config
func CORS() gin.HandlerFunc {
	// Try to use global config
	if config.GlobalConfig != nil {
		return CORSWithConfig(CORSConfig{
			AllowOrigins:     config.GlobalConfig.CORS.AllowOrigins,
			AllowMethods:     config.GlobalConfig.CORS.AllowMethods,
			AllowHeaders:     config.GlobalConfig.CORS.AllowHeaders,
			ExposeHeaders:    config.GlobalConfig.CORS.ExposeHeaders,
			AllowCredentials: config.GlobalConfig.CORS.AllowCredentials,
			MaxAge:           86400,
		})
	}
	return CORSWithConfig(DefaultCORSConfig())
}

// CORSWithConfig returns CORS middleware with custom config
func CORSWithConfig(cfg CORSConfig) gin.HandlerFunc {
	// Build origin matcher
	matcher := buildOriginMatcher(cfg.AllowOrigins)

	// Prepare header values
	allowMethodsStr := strings.Join(cfg.AllowMethods, ", ")
	allowHeadersStr := strings.Join(cfg.AllowHeaders, ", ")
	exposeHeadersStr := strings.Join(cfg.ExposeHeaders, ", ")

	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")

		// If no origin header, skip CORS
		if origin == "" {
			c.Next()
			return
		}

		// Check if origin is allowed
		var allowOrigin string
		if matcher.allowAll {
			allowOrigin = "*"
		} else if matcher.matches(origin) {
			allowOrigin = origin // Return actual origin for pattern matches
		}

		// If origin not allowed, skip CORS headers
		if allowOrigin == "" {
			c.Next()
			return
		}

		// Handle preflight request
		if c.Request.Method == http.MethodOptions {
			c.Header("Access-Control-Allow-Origin", allowOrigin)
			c.Header("Access-Control-Allow-Methods", allowMethodsStr)
			c.Header("Access-Control-Allow-Headers", allowHeadersStr)
			c.Header("Access-Control-Max-Age", "86400")

			if cfg.AllowCredentials && allowOrigin != "*" {
				c.Header("Access-Control-Allow-Credentials", "true")
			}

			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		// Handle simple/actual request
		c.Header("Access-Control-Allow-Origin", allowOrigin)
		if exposeHeadersStr != "" {
			c.Header("Access-Control-Expose-Headers", exposeHeadersStr)
		}
		if cfg.AllowCredentials && allowOrigin != "*" {
			c.Header("Access-Control-Allow-Credentials", "true")
		}

		c.Next()
	}
}

// buildOriginMatcher creates a matcher from origin patterns
func buildOriginMatcher(origins []string) *originMatcher {
	m := &originMatcher{
		exact:    make(map[string]bool),
		patterns: make([]*regexp.Regexp, 0),
	}

	for _, origin := range origins {
		origin = strings.TrimSpace(origin)

		// Check for global wildcard
		if origin == "*" {
			m.allowAll = true
			return m
		}

		// Check for patterns with wildcards
		if strings.Contains(origin, "*") {
			pattern := wildcardToRegex(origin)
			if re, err := regexp.Compile("(?i)^" + pattern + "$"); err == nil {
				m.patterns = append(m.patterns, re)
			}
		} else {
			// Exact match (case-insensitive)
			m.exact[strings.ToLower(origin)] = true
		}
	}

	return m
}

// wildcardToRegex converts wildcard pattern to regex
// Supports:
//   - http://localhost:*  -> matches any port
//   - https://*.example.com -> matches any subdomain
func wildcardToRegex(pattern string) string {
	// Escape regex special characters except *
	escaped := regexp.QuoteMeta(pattern)

	// Replace escaped \* with regex patterns
	// For port wildcard (localhost:*), match digits
	// For subdomain wildcard (*.example.com), match valid subdomain chars
	result := strings.ReplaceAll(escaped, `\*`, `[a-zA-Z0-9.-]*`)

	// Special case: port matching should only match digits
	result = strings.ReplaceAll(result, `:\[a-zA-Z0-9.-\]\*`, `:\d+`)

	return result
}

// matches checks if an origin matches any pattern
func (m *originMatcher) matches(origin string) bool {
	// Check exact match first
	if m.exact[strings.ToLower(origin)] {
		return true
	}

	// Check patterns
	for _, re := range m.patterns {
		if re.MatchString(origin) {
			return true
		}
	}

	return false
}
