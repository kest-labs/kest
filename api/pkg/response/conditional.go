// Package response provides conditional field helpers inspired by Laravel.
//
// These helpers allow you to conditionally include fields in API responses,
// making it easy to build dynamic response structures.
//
// Example:
//
//	response.Success(c, map[string]any{
//	    "id":       user.ID,
//	    "username": user.Username,
//	    "email":    response.When(isAdmin, user.Email),
//	    "profile":  response.WhenNotNil(user.Profile),
//	})
package response

// When returns the value if condition is true, otherwise returns nil (omitted from JSON).
// Use this to conditionally include fields in responses.
//
// Example:
//
//	map[string]any{
//	    "id":    user.ID,
//	    "email": response.When(user.IsVerified, user.Email),
//	    "role":  response.When(isAdmin, "admin", "user"),  // with default
//	}
func When[T any](condition bool, value T, defaultVal ...T) any {
	if condition {
		return value
	}
	if len(defaultVal) > 0 {
		return defaultVal[0]
	}
	return nil
}

// Unless returns the value if condition is false.
// Opposite of When.
func Unless[T any](condition bool, value T, defaultVal ...T) any {
	return When(!condition, value, defaultVal...)
}

// WhenNotNil returns the value if it's not nil, otherwise returns nil.
// Useful for optional fields that should only appear when set.
//
// Example:
//
//	map[string]any{
//	    "id":      user.ID,
//	    "avatar":  response.WhenNotNil(user.Avatar),
//	    "profile": response.WhenNotNil(user.Profile),
//	}
func WhenNotNil[T any](value *T) any {
	if value == nil {
		return nil
	}
	return *value
}

// WhenNotEmpty returns the value if it's not empty (zero value).
// Works with strings, slices, maps.
//
// Example:
//
//	map[string]any{
//	    "bio":  response.WhenNotEmpty(user.Bio),
//	    "tags": response.WhenNotEmpty(user.Tags),
//	}
func WhenNotEmpty(value any) any {
	if isEmpty(value) {
		return nil
	}
	return value
}

// WhenFunc returns the result of fn if condition is true.
// Useful for lazy evaluation of expensive computations.
//
// Example:
//
//	map[string]any{
//	    "stats": response.WhenFunc(includeStats, func() any {
//	        return computeExpensiveStats()
//	    }),
//	}
func WhenFunc(condition bool, fn func() any) any {
	if condition {
		return fn()
	}
	return nil
}

// Merge combines multiple maps into one.
// Useful for conditionally merging additional fields.
//
// Example:
//
//	base := map[string]any{"id": 1, "name": "test"}
//	extra := map[string]any{"admin": true}
//	result := response.Merge(base, response.MergeWhen(isAdmin, extra))
func Merge(maps ...map[string]any) map[string]any {
	result := make(map[string]any)
	for _, m := range maps {
		for k, v := range m {
			result[k] = v
		}
	}
	return result
}

// MergeWhen returns the map if condition is true, otherwise nil.
// Use with Merge for conditional field groups.
func MergeWhen(condition bool, data map[string]any) map[string]any {
	if condition {
		return data
	}
	return nil
}

// TransformValue applies a transformation function to the value.
// Returns nil if value is nil.
//
// Example:
//
//	map[string]any{
//	    "created_at": response.TransformValue(user.CreatedAt, func(t time.Time) any {
//	        return t.Format("2006-01-02")
//	    }),
//	}
func TransformValue[T any, R any](value T, fn func(T) R) any {
	return fn(value)
}

// TransformPtr applies transformation only if pointer is not nil.
func TransformPtr[T any, R any](value *T, fn func(T) R) any {
	if value == nil {
		return nil
	}
	return fn(*value)
}

// isEmpty checks if a value is empty
func isEmpty(value any) bool {
	if value == nil {
		return true
	}
	switch v := value.(type) {
	case string:
		return v == ""
	case []any:
		return len(v) == 0
	case map[string]any:
		return len(v) == 0
	default:
		return false
	}
}

// Pick extracts specified fields from a struct/map.
// Useful for selecting only certain fields to return.
//
// Example:
//
//	response.Success(c, response.Pick(user, "id", "username", "email"))
func Pick(data map[string]any, keys ...string) map[string]any {
	result := make(map[string]any)
	for _, key := range keys {
		if v, ok := data[key]; ok {
			result[key] = v
		}
	}
	return result
}

// Omit returns a map without the specified keys.
// Opposite of Pick.
//
// Example:
//
//	response.Success(c, response.Omit(userData, "password", "secret"))
func Omit(data map[string]any, keys ...string) map[string]any {
	result := make(map[string]any)
	omitSet := make(map[string]bool)
	for _, key := range keys {
		omitSet[key] = true
	}
	for k, v := range data {
		if !omitSet[k] {
			result[k] = v
		}
	}
	return result
}
