package request

import (
	"errors"
	"net/http"

	"github.com/kest-labs/kest/api/pkg/validation"
	"github.com/gin-gonic/gin"
)

// FormRequest defines the interface for form requests with validation
// FormRequest handles automatic validation of incoming requests.
type FormRequest interface {
	// Rules returns validation rules for the request
	Rules() map[string]string

	// Messages returns custom error messages (optional)
	Messages() map[string]string

	// Authorize determines if the user is authorized to make this request
	Authorize(c *gin.Context) bool
}

// BaseFormRequest provides a default implementation
type BaseFormRequest struct{}

// Rules returns empty rules by default
func (r *BaseFormRequest) Rules() map[string]string {
	return nil
}

// Messages returns empty messages by default
func (r *BaseFormRequest) Messages() map[string]string {
	return nil
}

// Authorize returns true by default
func (r *BaseFormRequest) Authorize(c *gin.Context) bool {
	return true
}

// ValidatedRequest wraps request data with validation
type ValidatedRequest[T any] struct {
	Data   T
	Errors validation.ValidationErrors
}

// Bind binds and validates a request
func Bind[T FormRequest](c *gin.Context, req T) (*ValidatedRequest[T], error) {
	result := &ValidatedRequest[T]{}

	// Bind request data
	if err := c.ShouldBind(req); err != nil {
		return nil, errors.New("invalid request data")
	}

	result.Data = req

	// Check authorization
	if !req.Authorize(c) {
		return nil, errors.New("unauthorized")
	}

	// Apply custom messages
	if messages := req.Messages(); messages != nil {
		validation.SetMessages(messages)
	}

	// Validate
	if errs := validation.Validate(req); errs != nil {
		result.Errors = errs
		return result, errs
	}

	return result, nil
}

// BindOrAbort binds, validates, and aborts on error
func BindOrAbort[T FormRequest](c *gin.Context, req T) *T {
	result, err := Bind(c, req)
	if err != nil {
		if verrs, ok := err.(validation.ValidationErrors); ok {
			c.JSON(http.StatusUnprocessableEntity, gin.H{
				"message": "validation failed",
				"errors":  verrs.ToMap(),
			})
		} else {
			c.JSON(http.StatusForbidden, gin.H{
				"message": err.Error(),
			})
		}
		c.Abort()
		return nil
	}
	return &result.Data
}

// ValidateStruct validates a struct and returns errors
func ValidateStruct(s interface{}) validation.ValidationErrors {
	return validation.Validate(s)
}

// ValidateOrAbort validates a struct and aborts on error
func ValidateOrAbort(c *gin.Context, s interface{}) bool {
	if errs := validation.Validate(s); errs != nil {
		c.JSON(http.StatusUnprocessableEntity, gin.H{
			"message": "validation failed",
			"errors":  errs.ToMap(),
		})
		return false
	}
	return true
}

// --- Request Helper Middleware ---

// WithValidation creates middleware that validates request body
func WithValidation[T FormRequest]() gin.HandlerFunc {
	return func(c *gin.Context) {
		var req T
		if BindOrAbort(c, req) == nil {
			c.Abort()
			return
		}
		c.Set("validated", req)
		c.Next()
	}
}

// GetValidatedForm retrieves validated form request from context
func GetValidatedForm[T any](c *gin.Context) (T, bool) {
	var zero T
	val, exists := c.Get("validated")
	if !exists {
		return zero, false
	}
	typed, ok := val.(T)
	return typed, ok
}
