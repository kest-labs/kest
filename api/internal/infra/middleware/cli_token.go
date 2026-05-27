package middleware

import (
	"context"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/kest-labs/kest/api/pkg/response"
)

type WorkspaceCLITokenValidator interface {
	ValidateCLIToken(ctx context.Context, workspaceID string, rawToken string, requiredScopes []string) (string, string, error)
}

// RequireWorkspaceCLIToken validates a workspace-scoped CLI token and enforces required scopes.
func RequireWorkspaceCLIToken(validator WorkspaceCLITokenValidator, requiredScopes ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := strings.TrimSpace(c.GetHeader("Authorization"))
		if authHeader == "" {
			response.Error(c, http.StatusUnauthorized, "Authorization header required")
			c.Abort()
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
			response.Error(c, http.StatusUnauthorized, "Invalid authorization format")
			c.Abort()
			return
		}

		workspaceIDStr := c.Param("id")
		if workspaceIDStr == "" {
			workspaceIDStr = c.Param("wid")
		}
		if workspaceIDStr == "" {
			response.Error(c, http.StatusBadRequest, "Invalid Workspace ID")
			c.Abort()
			return
		}

		if validator == nil {
			response.Error(c, http.StatusServiceUnavailable, "CLI token validation is not configured")
			c.Abort()
			return
		}

		tokenID, createdBy, err := validator.ValidateCLIToken(c.Request.Context(), workspaceIDStr, parts[1], requiredScopes)
		if err != nil {
			response.Error(c, http.StatusUnauthorized, err.Error())
			c.Abort()
			return
		}

		c.Set("cliTokenID", tokenID)
		c.Set("cliTokenCreatedBy", createdBy)
		c.Next()
	}
}
