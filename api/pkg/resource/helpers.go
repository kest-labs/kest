package resource

// ============================================================================
// Conditional Field Helpers
// ============================================================================
// Use these helpers in your transformer functions for conditional fields.

// When returns the value if condition is true, otherwise nil.
// Nil values are typically omitted from JSON with `omitempty`.
//
// Example:
//
//	func UserTransformer(u *User) map[string]any {
//	    return map[string]any{
//	        "id":       u.ID,
//	        "email":    resource.When(showEmail, u.Email),
//	        "is_admin": resource.When(u.IsAdmin, true),
//	    }
//	}
func When[T any](condition bool, value T) any {
	if condition {
		return value
	}
	return nil
}

// WhenNotEmpty returns the value if it's not empty string.
func WhenNotEmpty(value string) any {
	if value != "" {
		return value
	}
	return nil
}

// WhenNotNil returns the dereferenced value if pointer is not nil.
func WhenNotNil[T any](value *T) any {
	if value != nil {
		return *value
	}
	return nil
}

// WhenNotZero returns the value if it's not zero value.
func WhenNotZero[T comparable](value T) any {
	var zero T
	if value != zero {
		return value
	}
	return nil
}

// Unless returns the value if condition is false.
func Unless[T any](condition bool, value T) any {
	return When(!condition, value)
}

// ============================================================================
// Map Helpers
// ============================================================================

// Filter removes nil values from a map.
// Call this to clean up conditional fields.
//
// Example:
//
//	return resource.Filter(map[string]any{
//	    "id":     u.ID,
//	    "email":  resource.When(showEmail, u.Email),
//	    "avatar": resource.WhenNotEmpty(u.Avatar),
//	})
func Filter(m map[string]any) map[string]any {
	result := make(map[string]any)
	for k, v := range m {
		if v != nil {
			result[k] = v
		}
	}
	return result
}

// Merge combines multiple maps into one.
func Merge(maps ...map[string]any) map[string]any {
	result := make(map[string]any)
	for _, m := range maps {
		for k, v := range m {
			result[k] = v
		}
	}
	return result
}

// ============================================================================
// Slice Helpers
// ============================================================================

// Map transforms each item in a slice.
//
// Example:
//
//	tagNames := resource.Map(post.Tags, func(t *Tag) string {
//	    return t.Name
//	})
func Map[T any, R any](items []T, fn func(T) R) []R {
	result := make([]R, len(items))
	for i, item := range items {
		result[i] = fn(item)
	}
	return result
}

// Pluck extracts a single field from each item.
//
// Example:
//
//	ids := resource.Pluck(users, func(u *User) uint { return u.ID })
func Pluck[T any, R any](items []T, fn func(T) R) []R {
	return Map(items, fn)
}
