package support

import (
	"errors"
	"testing"
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
		{"non-zero int", 1, false},
		{"empty slice", []int{}, true},
		{"non-empty slice", []int{1, 2}, false},
		{"empty map", map[string]int{}, true},
		{"non-empty map", map[string]int{"a": 1}, false},
		{"false bool", false, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := Blank(tt.value); got != tt.expected {
				t.Errorf("Blank(%v) = %v, want %v", tt.value, got, tt.expected)
			}
		})
	}
}

func TestFilled(t *testing.T) {
	if !Filled("hello") {
		t.Error("Filled('hello') should be true")
	}
	if Filled("") {
		t.Error("Filled('') should be false")
	}
}

func TestTap(t *testing.T) {
	var sideEffect string
	result := Tap("hello", func(s string) {
		sideEffect = s + " world"
	})

	if result != "hello" {
		t.Errorf("Tap should return original value, got %s", result)
	}
	if sideEffect != "hello world" {
		t.Errorf("Tap should execute callback, got %s", sideEffect)
	}
}

func TestWith(t *testing.T) {
	result := With("hello", func(s string) string {
		return s + " world"
	})
	if result != "hello world" {
		t.Errorf("With should transform value, got %s", result)
	}
}

func TestTransform(t *testing.T) {
	result := Transform("hello", func(s string) string {
		return s + " world"
	}, "default")
	if result != "hello world" {
		t.Errorf("Transform should apply callback, got %s", result)
	}

	result = Transform("", func(s string) string {
		return s + " world"
	}, "default")
	if result != "default" {
		t.Errorf("Transform should return default for blank values, got %s", result)
	}
}

func TestRetry(t *testing.T) {
	attempts := 0
	result, err := Retry(3, func(attempt int) (string, error) {
		attempts = attempt
		if attempt < 3 {
			return "", errors.New("fail")
		}
		return "success", nil
	})

	if err != nil {
		t.Fatalf("expected Retry to succeed, got %v", err)
	}
	if result != "success" || attempts != 3 {
		t.Fatalf("unexpected Retry result=%q attempts=%d", result, attempts)
	}
}
