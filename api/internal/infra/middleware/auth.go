package middleware

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"

	idpkg "github.com/kest-labs/kest/api/pkg/id"
	"github.com/kest-labs/kest/api/pkg/response"
)

// PermissionProvider is an interface for checking project permissions
type PermissionProvider interface {
	CheckPermission(ctx context.Context, projectID string, userID string, requiredRole string) (bool, error)
}

// MockAuth extracts User ID from X-User-ID header for testing
func MockAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		userIDStr := c.GetHeader("X-User-ID")
		if userIDStr == "" {
			// Optional: In a real system, this would return 401
			// But here we might allow public access to some routes if not authenticated
			c.Next()
			return
		}

		userID, err := idpkg.Parse(userIDStr)
		if err != nil {
			response.Error(c, http.StatusUnauthorized, "Invalid User ID in header")
			c.Abort()
			return
		}

		c.Set("userID", userID)
		c.Next()
	}
}

// RequireProjectRole checks if the user has a sufficient role in the project
// It assumes projectID is in the URL as ":id" or ":pid"
func RequireProjectRole(memberService PermissionProvider, requiredRole string) gin.HandlerFunc {
	return func(c *gin.Context) {
		val, exists := c.Get("userID")
		if !exists {
			response.Error(c, http.StatusUnauthorized, "Authentication required")
			c.Abort()
			return
		}
		userID, err := idpkg.Normalize(val)
		if err != nil {
			response.Error(c, http.StatusUnauthorized, "Invalid user ID")
			c.Abort()
			return
		}

		// Try to find projectID in params
		projectIDStr := c.Param("id")
		if projectIDStr == "" {
			projectIDStr = c.Param("pid")
		}

		if projectIDStr == "" {
			// If not in URL, we might need a different way to find it,
			// but for target routes, it should be in the URL.
			response.Error(c, http.StatusBadRequest, "Project ID missing in request")
			c.Abort()
			return
		}

		allowed, err := memberService.CheckPermission(c.Request.Context(), projectIDStr, userID, requiredRole)
		if err != nil {
			response.Error(c, http.StatusInternalServerError, "Permission check failed")
			c.Abort()
			return
		}

		if !allowed {
			response.Error(c, http.StatusForbidden, "Permission denied")
			c.Abort()
			return
		}

		c.Next()
	}
}
