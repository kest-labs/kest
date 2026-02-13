// Package resource provides optional API resource transformation.
//
// This package is OPTIONAL. Most handlers can use response.Success() directly.
// Use resources only when you need:
//   - Reusable transformation logic across multiple endpoints
//   - Complex conditional field inclusion
//   - Consistent API output format for a model
//
// Simple Case (NO resource needed):
//
//	func (h *Handler) Get(c *gin.Context) {
//	    user, _ := h.service.GetByID(ctx, id)
//	    response.Success(c, user)  // Direct output
//	}
//
// With inline transformation (NO resource needed):
//
//	func (h *Handler) Get(c *gin.Context) {
//	    user, _ := h.service.GetByID(ctx, id)
//	    response.Transform(c, user, func(u *User) any {
//	        return map[string]any{"id": u.ID, "name": u.Username}
//	    })
//	}
//
// With Resource (for reusable transformations):
//
//	// Define once in dto.go or a separate file
//	func UserToAPI(u *domain.User) map[string]any {
//	    return map[string]any{
//	        "id":       u.ID,
//	        "username": u.Username,
//	        "email":    u.Email,
//	    }
//	}
//
//	// Use in handler
//	response.Transform(c, user, UserToAPI)
package resource

import (
	"github.com/kest-labs/kest/api/pkg/response"
)

// Transformer is a function that transforms a model to API output.
// This is the simplest way to define reusable transformations.
//
// Example:
//
//	var UserTransformer resource.Transformer[*domain.User] = func(u *domain.User) map[string]any {
//	    return map[string]any{
//	        "id":       u.ID,
//	        "username": u.Username,
//	    }
//	}
type Transformer[T any] func(T) map[string]any

// Apply transforms a single item.
func (t Transformer[T]) Apply(item T) map[string]any {
	return t(item)
}

// ApplyAll transforms a slice of items.
func (t Transformer[T]) ApplyAll(items []T) []map[string]any {
	result := make([]map[string]any, len(items))
	for i, item := range items {
		result[i] = t(item)
	}
	return result
}

// Resource interface for complex transformations.
// Implement this only when you need stateful transformation (e.g., conditional fields).
type Resource interface {
	ToArray() map[string]any
}

// Collection interface for paginated collections.
type Collection interface {
	ToArray() []map[string]any
	GetPaginator() response.Paginatable
}

// ============================================================================
// Simple Collection Helper
// ============================================================================

// SimpleCollection wraps items with optional pagination.
// Use this for quick collection responses without defining a type.
type SimpleCollection[T any] struct {
	items     []T
	paginator response.Paginatable
	transform Transformer[T]
}

// NewCollection creates a simple collection with a transformer.
//
// Example:
//
//	collection := resource.NewCollection(users, paginator, UserTransformer)
//	response.Collection(c, collection)
func NewCollection[T any](items []T, paginator response.Paginatable, transform Transformer[T]) *SimpleCollection[T] {
	return &SimpleCollection[T]{
		items:     items,
		paginator: paginator,
		transform: transform,
	}
}

// ToArray transforms all items.
func (c *SimpleCollection[T]) ToArray() []map[string]any {
	return c.transform.ApplyAll(c.items)
}

// GetPaginator returns the paginator.
func (c *SimpleCollection[T]) GetPaginator() response.Paginatable {
	return c.paginator
}
