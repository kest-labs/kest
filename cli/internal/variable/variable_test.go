package variable

import (
	"strings"
	"sync"
	"testing"
)

func TestInterpolate(t *testing.T) {
	tests := []struct {
		name     string
		text     string
		vars     map[string]string
		expected string
	}{
		{
			name:     "simple variable",
			text:     "Hello {{name}}",
			vars:     map[string]string{"name": "World"},
			expected: "Hello World",
		},
		{
			name:     "multiple variables",
			text:     "{{greeting}} {{name}}!",
			vars:     map[string]string{"greeting": "Hello", "name": "World"},
			expected: "Hello World!",
		},
		{
			name:     "undefined variable",
			text:     "Hello {{name}}",
			vars:     map[string]string{},
			expected: "Hello {{name}}",
		},
		{
			name:     "default value used",
			text:     `Hello {{name | default: "World"}}`,
			vars:     map[string]string{},
			expected: "Hello World",
		},
		{
			name:     "default value overridden",
			text:     `Hello {{name | default: "World"}}`,
			vars:     map[string]string{"name": "Alice"},
			expected: "Hello Alice",
		},
		{
			name:     "empty default value",
			text:     `{{name | default: ""}}`,
			vars:     map[string]string{},
			expected: "",
		},
		{
			name:     "default with spaces",
			text:     `{{msg | default: "Hello World"}}`,
			vars:     map[string]string{},
			expected: "Hello World",
		},
		{
			name:     "builtin $timestamp",
			text:     "Time: {{$timestamp}}",
			vars:     map[string]string{},
			expected: "Time: ", // Will have timestamp appended
		},
		{
			name:     "builtin $randomInt",
			text:     "Random: {{$randomInt}}",
			vars:     map[string]string{},
			expected: "Random: ", // Will have random number appended
		},
		{
			name:     "mixed variables and defaults",
			text:     `{{a | default: "1"}} {{b}} {{c | default: "3"}}`,
			vars:     map[string]string{"b": "2"},
			expected: "1 2 3",
		},
		{
			name:     "empty match",
			text:     "{{}}",
			vars:     map[string]string{},
			expected: "{{}}",
		},
		{
			name:     "short match",
			text:     "{{a",
			vars:     map[string]string{},
			expected: "{{a",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := Interpolate(tt.text, tt.vars)

			// For builtin variables, just check prefix
			if strings.Contains(tt.text, "$timestamp") || strings.Contains(tt.text, "$randomInt") {
				if !strings.HasPrefix(result, tt.expected) {
					t.Errorf("expected prefix %q, got %q", tt.expected, result)
				}
			} else {
				if result != tt.expected {
					t.Errorf("expected %q, got %q", tt.expected, result)
				}
			}
		})
	}
}

func TestInterpolateWithWarning(t *testing.T) {
	tests := []struct {
		name         string
		text         string
		vars         map[string]string
		verbose      bool
		expectedText string
		expectedWarn []string
	}{
		{
			name:         "no warnings when verbose false",
			text:         "{{undefined}}",
			vars:         map[string]string{},
			verbose:      false,
			expectedText: "{{undefined}}",
			expectedWarn: nil,
		},
		{
			name:         "warning when verbose true",
			text:         "{{undefined}}",
			vars:         map[string]string{},
			verbose:      true,
			expectedText: "{{undefined}}",
			expectedWarn: []string{"undefined"},
		},
		{
			name:         "multiple warnings",
			text:         "{{a}} {{b}} {{c}}",
			vars:         map[string]string{},
			verbose:      true,
			expectedText: "{{a}} {{b}} {{c}}",
			expectedWarn: []string{"a", "b", "c"},
		},
		{
			name:         "no warning for default values",
			text:         `{{name | default: "test"}}`,
			vars:         map[string]string{},
			verbose:      true,
			expectedText: "test",
			expectedWarn: nil,
		},
		{
			name:         "mixed defined and undefined",
			text:         "{{defined}} {{undefined}}",
			vars:         map[string]string{"defined": "value"},
			verbose:      true,
			expectedText: "value {{undefined}}",
			expectedWarn: []string{"undefined"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, warnings := InterpolateWithWarning(tt.text, tt.vars, tt.verbose)

			if result != tt.expectedText {
				t.Errorf("expected text %q, got %q", tt.expectedText, result)
			}

			if len(warnings) != len(tt.expectedWarn) {
				t.Errorf("expected %d warnings, got %d", len(tt.expectedWarn), len(warnings))
			}

			for i, w := range tt.expectedWarn {
				if i >= len(warnings) || warnings[i] != w {
					t.Errorf("expected warning %q at index %d, got %q", w, i, warnings[i])
				}
			}
		})
	}
}

func TestInterpolateStrict(t *testing.T) {
	tests := []struct {
		name      string
		text      string
		vars      map[string]string
		expectErr bool
		errMsg    string
	}{
		{
			name:      "all variables defined",
			text:      "{{a}} {{b}}",
			vars:      map[string]string{"a": "1", "b": "2"},
			expectErr: false,
		},
		{
			name:      "missing variable",
			text:      "{{undefined}}",
			vars:      map[string]string{},
			expectErr: true,
			errMsg:    "required variables not provided: undefined",
		},
		{
			name:      "multiple missing variables",
			text:      "{{a}} {{b}} {{c}}",
			vars:      map[string]string{},
			expectErr: true,
			errMsg:    "required variables not provided: a, b, c",
		},
		{
			name:      "default value prevents error",
			text:      `{{name | default: "admin"}}`,
			vars:      map[string]string{},
			expectErr: false,
		},
		{
			name:      "builtin variables ok",
			text:      "{{$timestamp}} {{$randomInt}}",
			vars:      map[string]string{},
			expectErr: false,
		},
		{
			name:      "mixed with default",
			text:      `{{a}} {{b | default: "2"}}`,
			vars:      map[string]string{"a": "1"},
			expectErr: false,
		},
		{
			name:      "empty match ignored",
			text:      "{{}}",
			vars:      map[string]string{},
			expectErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := InterpolateStrict(tt.text, tt.vars)

			if tt.expectErr && err == nil {
				t.Error("expected error, got nil")
			}

			if !tt.expectErr && err != nil {
				t.Errorf("unexpected error: %v", err)
			}

			if tt.expectErr && err != nil && err.Error() != tt.errMsg {
				t.Errorf("expected error %q, got %q", tt.errMsg, err.Error())
			}
		})
	}
}

func TestParseVarWithDefault(t *testing.T) {
	tests := []struct {
		name          string
		content       string
		expectedVar   string
		expectedValue string
	}{
		{
			name:          "no default",
			content:       "username",
			expectedVar:   "username",
			expectedValue: "",
		},
		{
			name:          "with default",
			content:       `username | default: "admin"`,
			expectedVar:   "username",
			expectedValue: "admin",
		},
		{
			name:          "with spaces",
			content:       `  username  |  default:  "admin"  `,
			expectedVar:   "username",
			expectedValue: "admin",
		},
		{
			name:          "empty default",
			content:       `username | default: ""`,
			expectedVar:   "username",
			expectedValue: "",
		},
		{
			name:          "default with spaces",
			content:       `msg | default: "Hello World"`,
			expectedVar:   "msg",
			expectedValue: "Hello World",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			varName, defaultValue := parseVarWithDefault(tt.content)

			if varName != tt.expectedVar {
				t.Errorf("expected var %q, got %q", tt.expectedVar, varName)
			}

			if defaultValue != tt.expectedValue {
				t.Errorf("expected default %q, got %q", tt.expectedValue, defaultValue)
			}
		})
	}
}

func TestIsBuiltinVar(t *testing.T) {
	tests := []struct {
		name     string
		varName  string
		expected bool
	}{
		{"$randomInt", "$randomInt", true},
		{"$timestamp", "$timestamp", true},
		{"regular var", "username", false},
		{"empty", "", false},
		{"$unknown", "$unknown", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := isBuiltinVar(tt.varName)
			if result != tt.expected {
				t.Errorf("expected %v, got %v", tt.expected, result)
			}
		})
	}
}

func TestResolveBuiltin(t *testing.T) {
	t.Run("$timestamp returns numeric string", func(t *testing.T) {
		result := resolveBuiltin("$timestamp")
		if result == "" {
			t.Error("expected non-empty timestamp")
		}
		// Should be numeric
		for _, c := range result {
			if c < '0' || c > '9' {
				t.Errorf("timestamp should be numeric, got %q", result)
				break
			}
		}
	})

	t.Run("$randomInt returns numeric string", func(t *testing.T) {
		result := resolveBuiltin("$randomInt")
		if result == "" {
			t.Error("expected non-empty random int")
		}
	})

	t.Run("unknown builtin returns empty", func(t *testing.T) {
		result := resolveBuiltin("$unknown")
		if result != "" {
			t.Errorf("expected empty string, got %q", result)
		}
	})
}

func TestSecureRandomInt(t *testing.T) {
	t.Run("returns value in range", func(t *testing.T) {
		max := 100
		for i := 0; i < 10; i++ {
			result := secureRandomInt(max)
			if result < 0 || result >= max {
				t.Errorf("expected value in [0, %d), got %d", max, result)
			}
		}
	})

	t.Run("handles zero max", func(t *testing.T) {
		result := secureRandomInt(0)
		if result != 0 {
			t.Errorf("expected 0, got %d", result)
		}
	})

	t.Run("handles negative max", func(t *testing.T) {
		result := secureRandomInt(-10)
		if result != 0 {
			t.Errorf("expected 0, got %d", result)
		}
	})
}

func TestConcurrentAccess(t *testing.T) {
	t.Run("concurrent Interpolate calls", func(t *testing.T) {
		text := "Random: {{$randomInt}}, Time: {{$timestamp}}"
		vars := map[string]string{}

		var wg sync.WaitGroup
		for i := 0; i < 100; i++ {
			wg.Add(1)
			go func() {
				defer wg.Done()
				result := Interpolate(text, vars)
				if !strings.Contains(result, "Random:") {
					t.Error("unexpected result")
				}
			}()
		}
		wg.Wait()
	})

	t.Run("concurrent secureRandomInt calls", func(t *testing.T) {
		var wg sync.WaitGroup
		for i := 0; i < 100; i++ {
			wg.Add(1)
			go func() {
				defer wg.Done()
				result := secureRandomInt(10000)
				if result < 0 || result >= 10000 {
					t.Errorf("value out of range: %d", result)
				}
			}()
		}
		wg.Wait()
	})
}

func BenchmarkInterpolate(b *testing.B) {
	text := `{"username": "{{username}}", "password": "{{password}}", "token": "{{token}}"}`
	vars := map[string]string{
		"username": "admin",
		"password": "secret",
		"token":    "abc123",
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		Interpolate(text, vars)
	}
}

func BenchmarkInterpolateWithDefault(b *testing.B) {
	text := `{"username": "{{username | default: \"admin\"}}", "password": "{{password | default: \"secret\"}}"}`
	vars := map[string]string{}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		Interpolate(text, vars)
	}
}

func BenchmarkInterpolateStrict(b *testing.B) {
	text := `{"username": "{{username}}", "password": "{{password}}"}`
	vars := map[string]string{
		"username": "admin",
		"password": "secret",
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		InterpolateStrict(text, vars)
	}
}

func BenchmarkSecureRandomInt(b *testing.B) {
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		secureRandomInt(10000)
	}
}
