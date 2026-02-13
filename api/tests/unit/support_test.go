package unit

import (
	"errors"
	"testing"

	"github.com/kest-labs/kest/api/pkg/support"
)

func TestBlank(t *testing.T) {
	tests := []struct {
		name     string
		value    any
		expected bool
	}{
		{"nil", nil, true},
		{"empty string", "", true},
		{"whitespace string", "   ", true},
		{"non-empty string", "hello", false},
		{"zero int", 0, false},
		{"positive int", 42, false},
		{"false bool", false, false},
		{"true bool", true, false},
		{"empty slice", []int{}, true},
		{"non-empty slice", []int{1, 2, 3}, false},
		{"empty map", map[string]int{}, true},
		{"non-empty map", map[string]int{"a": 1}, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := support.Blank(tt.value)
			if result != tt.expected {
				t.Errorf("Blank(%v) = %v, expected %v", tt.value, result, tt.expected)
			}
		})
	}
}

func TestFilled(t *testing.T) {
	if support.Filled(nil) {
		t.Error("Filled(nil) should be false")
	}
	if !support.Filled("hello") {
		t.Error("Filled(\"hello\") should be true")
	}
	if support.Filled("") {
		t.Error("Filled(\"\") should be false")
	}
}

func TestTap(t *testing.T) {
	value := 10
	called := false

	result := support.Tap(value, func(v int) {
		called = true
		if v != 10 {
			t.Errorf("Expected 10, got %d", v)
		}
	})

	if !called {
		t.Error("Callback should have been called")
	}
	if result != value {
		t.Errorf("Expected %d, got %d", value, result)
	}
}

func TestWith(t *testing.T) {
	result := support.With(5, func(v int) int {
		return v * 2
	})

	if result != 10 {
		t.Errorf("Expected 10, got %d", result)
	}
}

func TestIfVal(t *testing.T) {
	if support.IfVal(true, "yes", "no") != "yes" {
		t.Error("IfVal(true) should return first value")
	}
	if support.IfVal(false, "yes", "no") != "no" {
		t.Error("IfVal(false) should return default value")
	}
}

func TestUnlessVal(t *testing.T) {
	if support.UnlessVal(false, "yes", "no") != "yes" {
		t.Error("UnlessVal(false) should return first value")
	}
	if support.UnlessVal(true, "yes", "no") != "no" {
		t.Error("UnlessVal(true) should return default value")
	}
}

func TestTransform(t *testing.T) {
	result := support.Transform("hello", func(s string) int {
		return len(s)
	}, 0)

	if result != 5 {
		t.Errorf("Expected 5, got %d", result)
	}

	// Test with blank value
	result2 := support.Transform("", func(s string) int {
		return len(s)
	}, -1)

	if result2 != -1 {
		t.Errorf("Expected -1 for blank value, got %d", result2)
	}
}

func TestRescue(t *testing.T) {
	// Test successful execution
	result := support.Rescue(func() int {
		return 42
	}, 0)

	if result != 42 {
		t.Errorf("Expected 42, got %d", result)
	}

	// Test panic recovery
	result2 := support.Rescue(func() int {
		panic("test panic")
	}, -1)

	if result2 != -1 {
		t.Errorf("Expected -1 after panic, got %d", result2)
	}
}

func TestRetry(t *testing.T) {
	attempts := 0

	result, err := support.Retry(3, func(attempt int) (string, error) {
		attempts = attempt
		if attempt < 3 {
			return "", errors.New("retry")
		}
		return "success", nil
	})

	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}
	if result != "success" {
		t.Errorf("Expected 'success', got '%s'", result)
	}
	if attempts != 3 {
		t.Errorf("Expected 3 attempts, got %d", attempts)
	}
}

func TestMust(t *testing.T) {
	// Test successful case
	result := support.Must(42, nil)
	if result != 42 {
		t.Errorf("Expected 42, got %d", result)
	}

	// Test panic case
	defer func() {
		if r := recover(); r == nil {
			t.Error("Expected panic")
		}
	}()
	support.Must(0, errors.New("test error"))
}

func TestCoalesce(t *testing.T) {
	result := support.Coalesce("", "   ", "hello", "world")
	if result != "hello" {
		t.Errorf("Expected 'hello', got '%s'", result)
	}

	result2 := support.Coalesce("first", "second")
	if result2 != "first" {
		t.Errorf("Expected 'first', got '%s'", result2)
	}
}

func TestDefault(t *testing.T) {
	if support.Default("", "default") != "default" {
		t.Error("Default should return default for blank value")
	}
	if support.Default("value", "default") != "value" {
		t.Error("Default should return value when filled")
	}
}

func TestFlow(t *testing.T) {
	result := support.Flow(5,
		func(v int) int { return v * 2 },
		func(v int) int { return v + 3 },
		func(v int) int { return v * 2 },
	)

	// (5 * 2 + 3) * 2 = 26
	if result != 26 {
		t.Errorf("Expected 26, got %d", result)
	}
}

func TestThrowIf(t *testing.T) {
	err := support.ThrowIf(true, errors.New("test"))
	if err == nil {
		t.Error("Expected error when condition is true")
	}

	err = support.ThrowIf(false, errors.New("test"))
	if err != nil {
		t.Error("Expected no error when condition is false")
	}
}

func TestThrowUnless(t *testing.T) {
	err := support.ThrowUnless(false, errors.New("test"))
	if err == nil {
		t.Error("Expected error when condition is false")
	}

	err = support.ThrowUnless(true, errors.New("test"))
	if err != nil {
		t.Error("Expected no error when condition is true")
	}
}

func TestOptional(t *testing.T) {
	value := 42
	opt := support.Of(&value)

	if !opt.IsPresent() {
		t.Error("Optional should be present")
	}

	if opt.Get(0) != 42 {
		t.Errorf("Expected 42, got %d", opt.Get(0))
	}

	// Test nil
	var nilVal *int
	optNil := support.Of(nilVal)

	if optNil.IsPresent() {
		t.Error("Optional should not be present for nil")
	}

	if optNil.OrElse(func() int { return 99 }) != 99 {
		t.Error("OrElse should return default for nil")
	}
}

func TestDataGet(t *testing.T) {
	data := map[string]any{
		"user": map[string]any{
			"name": "John",
			"age":  30,
		},
		"items": []any{"a", "b", "c"},
	}

	// Test nested map access
	name := support.DataGet(data, "user.name")
	if name != "John" {
		t.Errorf("Expected 'John', got '%v'", name)
	}

	// Test with default
	missing := support.DataGet(data, "user.email", "default@example.com")
	if missing != "default@example.com" {
		t.Errorf("Expected default value, got '%v'", missing)
	}

	// Test array access
	item := support.DataGet(data, "items.1")
	if item != "b" {
		t.Errorf("Expected 'b', got '%v'", item)
	}
}

func TestDataHas(t *testing.T) {
	data := map[string]any{
		"user": map[string]any{
			"name": "John",
		},
	}

	if !support.DataHas(data, "user.name") {
		t.Error("DataHas should return true for existing key")
	}

	if support.DataHas(data, "user.email") {
		t.Error("DataHas should return false for non-existing key")
	}
}

func TestPaths(t *testing.T) {
	support.SetBasePath("/test/project")

	if support.BasePath() != "/test/project" {
		t.Errorf("Expected '/test/project', got '%s'", support.BasePath())
	}

	if support.StoragePath("logs") != "/test/project/storage/logs" {
		t.Errorf("Expected '/test/project/storage/logs', got '%s'", support.StoragePath("logs"))
	}

	if support.ConfigPath("app.yaml") != "/test/project/config/app.yaml" {
		t.Errorf("Expected '/test/project/config/app.yaml', got '%s'", support.ConfigPath("app.yaml"))
	}
}
