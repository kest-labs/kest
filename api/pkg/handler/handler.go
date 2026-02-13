// Package handler provides common utilities for HTTP handlers.
//
// This package reduces boilerplate in handlers by providing:
//   - Parameter parsing (ID, query params)
//   - User context extraction
//   - Common validation helpers
//
// Example:
//
//	func (h *Handler) Get(c *gin.Context) {
//	    id, ok := handler.ParseID(c, "id")
//	    if !ok {
//	        return
//	    }
//	    // ...
//	}
package handler

import (
	"strconv"

	"github.com/kest-labs/kest/api/pkg/response"
	"github.com/gin-gonic/gin"
)

// ParseID extracts and validates an ID parameter from the URL.
// Returns 0 and false if invalid, automatically sends error response.
//
// Example:
//
//	id, ok := handler.ParseID(c, "id")
//	if !ok {
//	    return // Error response already sent
//	}
func ParseID(c *gin.Context, param string) (uint, bool) {
	idStr := c.Param(param)
	id, err := strconv.ParseUint(idStr, 10, 64)
	if err != nil {
		response.BadRequest(c, "Invalid ID format", err)
		return 0, false
	}
	return uint(id), true
}

// ParseInt64ID extracts and validates an int64 ID parameter.
func ParseInt64ID(c *gin.Context, param string) (int64, bool) {
	idStr := c.Param(param)
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		response.BadRequest(c, "Invalid ID format", err)
		return 0, false
	}
	return id, true
}

// GetUserID extracts the authenticated user ID from context.
// Returns 0 and false if not authenticated, automatically sends 401.
//
// Example:
//
//	userID, ok := handler.GetUserID(c)
//	if !ok {
//	    return // 401 already sent
//	}
func GetUserID(c *gin.Context) (uint, bool) {
	userIDVal, exists := c.Get("userID")
	if !exists {
		response.Unauthorized(c)
		return 0, false
	}

	switch v := userIDVal.(type) {
	case uint:
		return v, true
	case int:
		return uint(v), true
	case int64:
		return uint(v), true
	case uint64:
		return uint(v), true
	case float64:
		return uint(v), true
	default:
		response.InternalServerError(c, "Invalid user ID type", nil)
		return 0, false
	}
}

// GetUserIDInt64 extracts the authenticated user ID as int64.
func GetUserIDInt64(c *gin.Context) (int64, bool) {
	id, ok := GetUserID(c)
	return int64(id), ok
}

// MustGetUserID extracts user ID, panics if not found.
// Use only when you're certain the user is authenticated (e.g., after auth middleware).
func MustGetUserID(c *gin.Context) uint {
	id, ok := GetUserID(c)
	if !ok {
		panic("user ID not found in context")
	}
	return id
}

// BindJSON binds JSON request body and sends error response if invalid.
// Returns false if binding failed (error response already sent).
//
// Example:
//
//	var req CreateUserRequest
//	if !handler.BindJSON(c, &req) {
//	    return
//	}
func BindJSON(c *gin.Context, obj any) bool {
	if err := c.ShouldBindJSON(obj); err != nil {
		response.BadRequest(c, "Invalid request parameters", err)
		return false
	}
	return true
}

// BindQuery binds query parameters and sends error response if invalid.
func BindQuery(c *gin.Context, obj any) bool {
	if err := c.ShouldBindQuery(obj); err != nil {
		response.BadRequest(c, "Invalid query parameters", err)
		return false
	}
	return true
}

// BindURI binds URI parameters and sends error response if invalid.
func BindURI(c *gin.Context, obj any) bool {
	if err := c.ShouldBindUri(obj); err != nil {
		response.BadRequest(c, "Invalid URI parameters", err)
		return false
	}
	return true
}

// QueryInt gets an integer query parameter with default value.
func QueryInt(c *gin.Context, key string, defaultVal int) int {
	val := c.Query(key)
	if val == "" {
		return defaultVal
	}
	i, err := strconv.Atoi(val)
	if err != nil {
		return defaultVal
	}
	return i
}

// QueryInt64 gets an int64 query parameter with default value.
func QueryInt64(c *gin.Context, key string, defaultVal int64) int64 {
	val := c.Query(key)
	if val == "" {
		return defaultVal
	}
	i, err := strconv.ParseInt(val, 10, 64)
	if err != nil {
		return defaultVal
	}
	return i
}

// QueryBool gets a boolean query parameter with default value.
func QueryBool(c *gin.Context, key string, defaultVal bool) bool {
	val := c.Query(key)
	if val == "" {
		return defaultVal
	}
	b, err := strconv.ParseBool(val)
	if err != nil {
		return defaultVal
	}
	return b
}
