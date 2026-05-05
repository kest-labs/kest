package support

import (
	"reflect"
	"strings"
)

// Blank determines if the given value is "blank"
// Returns true for: nil, empty string, empty slice/map, zero values
func Blank(value any) bool {
	if value == nil {
		return true
	}

	v := reflect.ValueOf(value)
	switch v.Kind() {
	case reflect.String:
		return strings.TrimSpace(v.String()) == ""
	case reflect.Slice, reflect.Map, reflect.Array:
		return v.Len() == 0
	case reflect.Bool:
		return false // booleans are never blank
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
		return false // numbers are never blank
	case reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64:
		return false
	case reflect.Float32, reflect.Float64:
		return false
	case reflect.Ptr, reflect.Interface:
		if v.IsNil() {
			return true
		}
		return Blank(v.Elem().Interface())
	default:
		return v.IsZero()
	}
}

// Filled determines if a value is "filled" (not blank)
func Filled(value any) bool {
	return !Blank(value)
}

// Tap calls the given callback with the given value then returns the value
func Tap[T any](value T, callbacks ...func(T)) T {
	for _, callback := range callbacks {
		callback(value)
	}
	return value
}

// With returns the given value, optionally passed through the given callback
func With[T any, R any](value T, callback func(T) R) R {
	return callback(value)
}

// IfVal returns the value if condition is true, otherwise returns the default
func IfVal[T any](condition bool, value T, defaultVal T) T {
	if condition {
		return value
	}
	return defaultVal
}

// WhenFunc returns the result of valueFunc if condition is true, otherwise returns defaultFunc result
func WhenFunc[T any](condition bool, valueFunc func() T, defaultFunc func() T) T {
	if condition {
		return valueFunc()
	}
	if defaultFunc != nil {
		return defaultFunc()
	}
	var zero T
	return zero
}

// UnlessVal returns the value if condition is false, otherwise returns the default
func UnlessVal[T any](condition bool, value T, defaultVal T) T {
	return IfVal(!condition, value, defaultVal)
}

// Value returns the value itself, or calls it if it's a function
func Value[T any](value any) T {
	if fn, ok := value.(func() T); ok {
		return fn()
	}
	if v, ok := value.(T); ok {
		return v
	}
	var zero T
	return zero
}

// Transform transforms the value if it's filled, otherwise returns the default
func Transform[T any, R any](value T, callback func(T) R, defaultVal R) R {
	if Filled(value) {
		return callback(value)
	}
	return defaultVal
}

// Rescue catches any panic and returns the rescue value
func Rescue[T any](callback func() T, rescue T) (result T) {
	defer func() {
		if r := recover(); r != nil {
			result = rescue
		}
	}()
	return callback()
}

// RescueWith catches any panic and returns the result of rescue function
func RescueWith[T any](callback func() T, rescue func(any) T) (result T) {
	defer func() {
		if r := recover(); r != nil {
			result = rescue(r)
		}
	}()
	return callback()
}

// Retry retries the callback the given number of times
func Retry[T any](times int, callback func(attempt int) (T, error)) (T, error) {
	var lastErr error
	var zero T

	for i := 1; i <= times; i++ {
		result, err := callback(i)
		if err == nil {
			return result, nil
		}
		lastErr = err
	}

	return zero, lastErr
}

// Once ensures a callback is only called once (per key)
var onceCache = make(map[string]any)

func Once[T any](key string, callback func() T) T {
	if v, ok := onceCache[key]; ok {
		return v.(T)
	}
	result := callback()
	onceCache[key] = result
	return result
}

// Optional provides safe access to potentially nil values
type Optional[T any] struct {
	value *T
}

// Of creates an Optional from a value
func Of[T any](value *T) Optional[T] {
	return Optional[T]{value: value}
}

// Get returns the value or the default if nil
func (o Optional[T]) Get(defaultVal T) T {
	if o.value == nil {
		return defaultVal
	}
	return *o.value
}

// OrElse returns the value or calls the function if nil
func (o Optional[T]) OrElse(fn func() T) T {
	if o.value == nil {
		return fn()
	}
	return *o.value
}

// IsPresent returns true if the value is not nil
func (o Optional[T]) IsPresent() bool {
	return o.value != nil
}

// IfPresent calls the callback if value is present
func (o Optional[T]) IfPresent(callback func(T)) {
	if o.value != nil {
		callback(*o.value)
	}
}

// ThrowIf throws an error if the condition is true
func ThrowIf(condition bool, err error) error {
	if condition {
		return err
	}
	return nil
}

// ThrowUnless throws an error if the condition is false
func ThrowUnless(condition bool, err error) error {
	return ThrowIf(!condition, err)
}

// Must panics if err is not nil, otherwise returns the value
func Must[T any](value T, err error) T {
	if err != nil {
		panic(err)
	}
	return value
}

// Coalesce returns the first non-blank value
func Coalesce[T any](values ...T) T {
	for _, v := range values {
		if Filled(v) {
			return v
		}
	}
	var zero T
	return zero
}

// Default returns the value if filled, otherwise returns the default
func Default[T any](value T, defaultVal T) T {
	if Filled(value) {
		return value
	}
	return defaultVal
}

// Flow passes the value through a series of callbacks
func Flow[T any](value T, callbacks ...func(T) T) T {
	for _, callback := range callbacks {
		value = callback(value)
	}
	return value
}
