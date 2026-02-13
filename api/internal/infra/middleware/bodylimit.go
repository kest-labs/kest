package middleware

import (
	"net/http"

	"github.com/kest-labs/kest/api/internal/infra/config"
	"github.com/gin-gonic/gin"
)

// BodyLimitConfig holds body limit middleware configuration
type BodyLimitConfig struct {
	// MaxSize is the maximum allowed request body size in bytes
	// Default: 10MB
	MaxSize int64

	// ErrorMessage is the message returned when limit is exceeded
	// Default: "Request body too large"
	ErrorMessage string
}

// DefaultBodyLimitConfig returns default body limit configuration
func DefaultBodyLimitConfig() BodyLimitConfig {
	return BodyLimitConfig{
		MaxSize:      10 * 1024 * 1024, // 10MB
		ErrorMessage: "Request body too large",
	}
}

// BodyLimitFromConfig returns body limit middleware using global config
// Uses MIDDLEWARE_BODY_LIMIT_MB env var (in megabytes)
func BodyLimitFromConfig() gin.HandlerFunc {
	maxSize := int64(10 * 1024 * 1024) // default 10MB
	if config.GlobalConfig != nil && config.GlobalConfig.Middleware.BodyLimit > 0 {
		maxSize = config.GlobalConfig.Middleware.BodyLimit
	}
	return BodyLimit(maxSize)
}

// BodyLimit returns body limit middleware with size in bytes
func BodyLimit(maxSize int64) gin.HandlerFunc {
	return BodyLimitWithConfig(BodyLimitConfig{
		MaxSize:      maxSize,
		ErrorMessage: "Request body too large",
	})
}

// BodyLimitWithConfig returns body limit middleware with custom config
func BodyLimitWithConfig(cfg BodyLimitConfig) gin.HandlerFunc {
	if cfg.MaxSize <= 0 {
		cfg.MaxSize = 4 * 1024 * 1024
	}
	if cfg.ErrorMessage == "" {
		cfg.ErrorMessage = "Request body too large"
	}

	return func(c *gin.Context) {
		// Check Content-Length header first (fast path)
		if c.Request.ContentLength > cfg.MaxSize {
			c.AbortWithStatusJSON(http.StatusRequestEntityTooLarge, gin.H{
				"success": false,
				"error": gin.H{
					"code":    "BODY_TOO_LARGE",
					"message": cfg.ErrorMessage,
				},
			})
			return
		}

		// Wrap the body with a size limiter
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, cfg.MaxSize)

		c.Next()

		// Check if we hit the limit during body read
		if c.Errors.Last() != nil && c.Errors.Last().Error() == "http: request body too large" {
			c.AbortWithStatusJSON(http.StatusRequestEntityTooLarge, gin.H{
				"success": false,
				"error": gin.H{
					"code":    "BODY_TOO_LARGE",
					"message": cfg.ErrorMessage,
				},
			})
		}
	}
}
