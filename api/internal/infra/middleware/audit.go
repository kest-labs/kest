package middleware

import (
	"bytes"
	"context"
	"io"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/kest-labs/kest/api/internal/modules/audit"
	"github.com/kest-labs/kest/api/pkg/handler"
)

var auditRepo audit.Repository

// SetAuditRepository sets the audit repository for middleware use
func SetAuditRepository(repo audit.Repository) {
	auditRepo = repo
}

// AuditLog middleware captures and records sensitive user actions
func AuditLog() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()

		// Read request body for logging
		var bodyBytes []byte
		if c.Request.Body != nil {
			bodyBytes, _ = io.ReadAll(c.Request.Body)
			// Restore request body for subsequent handlers
			c.Request.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))
		}

		c.Next()

		// Only log sensitive state-changing methods
		method := c.Request.Method
		if method == "GET" || method == "OPTIONS" || method == "HEAD" {
			return
		}

		if auditRepo == nil {
			return // Logging skipped if repo not set
		}

		// Extract authenticated user ID
		userID, ok := handler.GetUserID(c)
		if !ok {
			userID = 0 // Anonymous or failed auth
		}

		// Determine resource from path (simple heuristic)
		// e.g., /api/v1/projects -> projects
		path := c.Request.URL.Path

		// Create log entry
		log := &audit.AuditLogPO{
			UserID:    userID,
			Action:    method, // POST, PATCH, DELETE
			Resource:  path,   // Full path as resource identifier
			Method:    method,
			Path:      path,
			IP:        c.ClientIP(),
			UserAgent: c.Request.UserAgent(),
			Status:    c.Writer.Status(),
			Duration:  time.Since(start).Milliseconds(),
		}

		// Asynchronously save log to avoid blocking response
		go func(l *audit.AuditLogPO) {
			// Create a new background context since request context is cancelled
			_ = auditRepo.Create(context.Background(), l)
		}(log) // Pass log by value/pointer as needed, usually safe if creating new struct
	}
}
