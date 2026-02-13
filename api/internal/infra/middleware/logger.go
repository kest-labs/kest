package middleware

import (
	"time"

	"github.com/kest-labs/kest/api/pkg/logger"
	"github.com/gin-gonic/gin"
)

// Logger is the request logging middleware
func Logger() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		path := c.Request.URL.Path
		raw := c.Request.URL.RawQuery

		// Process request
		c.Next()

		// Request processed
		latency := time.Since(start)
		clientIP := c.ClientIP()
		method := c.Request.Method
		statusCode := c.Writer.Status()

		if raw != "" {
			path = path + "?" + raw
		}

		logger.Info("HTTP Request", map[string]any{
			"status":    statusCode,
			"latency":   latency.String(),
			"client_ip": clientIP,
			"method":    method,
			"path":      path,
		})
	}
}
