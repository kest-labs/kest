package middleware

import (
	"net/http"
	"runtime/debug"

	"github.com/kest-labs/kest/api/pkg/logger"
	"github.com/kest-labs/kest/api/pkg/response"
	"github.com/gin-gonic/gin"
)

// Recovery middleware handles panic recovery
func Recovery() gin.HandlerFunc {
	return func(c *gin.Context) {
		defer func() {
			if err := recover(); err != nil {
				// Log stack trace
				logger.Error("Panic recovered", map[string]any{"error": err})
				logger.Debug("Stack trace", map[string]any{"stack": string(debug.Stack())})

				response.Error(c, http.StatusInternalServerError, "Internal server error")
				c.Abort()
			}
		}()
		c.Next()
	}
}
