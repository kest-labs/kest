package middleware

import (
	"net/http"
	"strings"

	"github.com/kest-labs/kest/api/internal/infra/jwt"
	"github.com/kest-labs/kest/api/pkg/response"
	"github.com/gin-gonic/gin"
)

// jwtService holds the JWT service instance for middleware use.
// Set via SetJWTService during application initialization.
var jwtService *jwt.Service

// SetJWTService sets the JWT service for middleware use.
// This should be called during application initialization.
func SetJWTService(svc *jwt.Service) {
	jwtService = svc
}

// JWTAuth creates a JWT authentication middleware.
// Requires SetJWTService to be called first.
func JWTAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		if jwtService == nil {
			response.Error(c, http.StatusInternalServerError, "JWT service not initialized")
			c.Abort()
			return
		}

		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			response.Error(c, http.StatusUnauthorized, "Authorization header required")
			c.Abort()
			return
		}

		// Check Bearer token format
		parts := strings.SplitN(authHeader, " ", 2)
		if !(len(parts) == 2 && parts[0] == "Bearer") {
			response.Error(c, http.StatusUnauthorized, "Invalid authorization format")
			c.Abort()
			return
		}

		// Parse token using injected service
		claims, err := jwtService.ParseToken(parts[1])
		if err != nil {
			response.Error(c, http.StatusUnauthorized, "Invalid or expired token")
			c.Abort()
			return
		}

		// Store user information in context
		c.Set("userID", claims.UserID)
		c.Set("username", claims.Username)

		c.Next()
	}
}

// JWTAuthWithService creates a JWT middleware with explicit service injection.
// Use this when you have access to the JWT service instance.
func JWTAuthWithService(svc *jwt.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			response.Error(c, http.StatusUnauthorized, "Authorization header required")
			c.Abort()
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if !(len(parts) == 2 && parts[0] == "Bearer") {
			response.Error(c, http.StatusUnauthorized, "Invalid authorization format")
			c.Abort()
			return
		}

		claims, err := svc.ParseToken(parts[1])
		if err != nil {
			response.Error(c, http.StatusUnauthorized, "Invalid or expired token")
			c.Abort()
			return
		}

		c.Set("userID", claims.UserID)
		c.Set("username", claims.Username)

		c.Next()
	}
}
