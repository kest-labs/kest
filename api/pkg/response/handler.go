package response

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/kest-labs/kest/api/internal/domain"
	"gorm.io/gorm"
)

// Common domain errors that can be mapped to HTTP responses.
// Define these in your domain package and use HandleError for automatic mapping.
var (
	ErrNotFound     = errors.New("not found")
	ErrUnauthorized = errors.New("unauthorized")
	ErrForbidden    = errors.New("forbidden")
	ErrConflict     = errors.New("conflict")
	ErrValidation   = errors.New("validation failed")
)

// ErrorMapper maps domain errors to HTTP status codes.
type ErrorMapper struct {
	mappings map[error]int
}

// DefaultErrorMapper provides default error to status code mappings.
var DefaultErrorMapper = &ErrorMapper{
	mappings: map[error]int{
		ErrNotFound:                  http.StatusNotFound,
		ErrUnauthorized:              http.StatusUnauthorized,
		ErrForbidden:                 http.StatusForbidden,
		ErrConflict:                  http.StatusConflict,
		ErrValidation:                http.StatusUnprocessableEntity,
		domain.ErrConflict:           http.StatusConflict,
		domain.ErrEmailAlreadyExists: http.StatusConflict,
		domain.ErrInvalidCredentials: http.StatusUnauthorized,
		domain.ErrAccountDisabled:    http.StatusForbidden,
		gorm.ErrRecordNotFound:       http.StatusNotFound,
	},
}

// Register adds a custom error mapping.
func (m *ErrorMapper) Register(err error, statusCode int) {
	m.mappings[err] = statusCode
}

// GetStatusCode returns the HTTP status code for an error.
func (m *ErrorMapper) GetStatusCode(err error) int {
	for mappedErr, code := range m.mappings {
		if errors.Is(err, mappedErr) {
			return code
		}
	}
	return http.StatusInternalServerError
}

// HandleError automatically maps errors to appropriate HTTP responses.
// It checks for common error types and returns the correct status code.
//
// Example:
//
//	user, err := service.GetUser(id)
//	if err != nil {
//	    response.HandleError(c, "Failed to get user", err)
//	    return
//	}
//
// Error Mapping:
//   - gorm.ErrRecordNotFound -> 404 Not Found
//   - ErrUnauthorized -> 401 Unauthorized
//   - ErrForbidden -> 403 Forbidden
//   - ErrConflict -> 409 Conflict
//   - ErrValidation -> 422 Unprocessable Entity
//   - Other errors -> 500 Internal Server Error
func HandleError(c *gin.Context, message string, err error) {
	if err == nil {
		InternalServerError(c, message)
		return
	}

	statusCode := DefaultErrorMapper.GetStatusCode(err)
	ErrorWithDetails(c, statusCode, message, err)
}

// HandleErrorWithMapper uses a custom error mapper.
func HandleErrorWithMapper(c *gin.Context, message string, err error, mapper *ErrorMapper) {
	if err == nil {
		InternalServerError(c, message)
		return
	}

	statusCode := mapper.GetStatusCode(err)
	ErrorWithDetails(c, statusCode, message, err)
}

// Abort sends an error response and aborts the request chain.
// Use this in middleware to stop request processing.
//
// Example:
//
//	func AuthMiddleware() gin.HandlerFunc {
//	    return func(c *gin.Context) {
//	        if !isAuthenticated(c) {
//	            response.Abort(c, http.StatusUnauthorized, "Authentication required")
//	            return
//	        }
//	        c.Next()
//	    }
//	}
func Abort(c *gin.Context, statusCode int, message string) {
	c.AbortWithStatusJSON(statusCode, ErrorResponse{
		Code:    statusCode,
		Message: message,
	})
}

// AbortWithError sends an error response with details and aborts.
func AbortWithError(c *gin.Context, statusCode int, message string, err error) {
	errMsg := ""
	if err != nil {
		errMsg = err.Error()
	}
	c.AbortWithStatusJSON(statusCode, ErrorResponse{
		Code:    statusCode,
		Message: message,
		Error:   errMsg,
	})
}

// AbortUnauthorized is a shortcut for unauthorized abort.
func AbortUnauthorized(c *gin.Context, message ...string) {
	msg := "Unauthorized"
	if len(message) > 0 {
		msg = message[0]
	}
	Abort(c, http.StatusUnauthorized, msg)
}

// AbortForbidden is a shortcut for forbidden abort.
func AbortForbidden(c *gin.Context, message ...string) {
	msg := "Forbidden"
	if len(message) > 0 {
		msg = message[0]
	}
	Abort(c, http.StatusForbidden, msg)
}

// AbortNotFound is a shortcut for not found abort.
func AbortNotFound(c *gin.Context, message ...string) {
	msg := "Not found"
	if len(message) > 0 {
		msg = message[0]
	}
	Abort(c, http.StatusNotFound, msg)
}

// AbortBadRequest is a shortcut for bad request abort.
func AbortBadRequest(c *gin.Context, message string) {
	Abort(c, http.StatusBadRequest, message)
}

// AbortTooManyRequests is a shortcut for rate limit abort.
func AbortTooManyRequests(c *gin.Context, message ...string) {
	msg := "Too many requests"
	if len(message) > 0 {
		msg = message[0]
	}
	Abort(c, http.StatusTooManyRequests, msg)
}
