package unit

import (
	"os"
	"testing"

	"github.com/kest-labs/kest/api/pkg/env"
)

func TestEnv_Get(t *testing.T) {
	// Set a test variable
	os.Setenv("TEST_VAR", "test_value")
	defer os.Unsetenv("TEST_VAR")

	value := env.Get("TEST_VAR")
	if value != "test_value" {
		t.Errorf("Expected 'test_value', got '%s'", value)
	}
}

func TestEnv_GetWithDefault(t *testing.T) {
	os.Unsetenv("NON_EXISTENT_VAR")

	value := env.Get("NON_EXISTENT_VAR", "default_value")
	if value != "default_value" {
		t.Errorf("Expected 'default_value', got '%s'", value)
	}
}

func TestEnv_GetBool(t *testing.T) {
	tests := []struct {
		value    string
		expected bool
	}{
		{"true", true},
		{"TRUE", true},
		{"True", true},
		{"1", true},
		{"yes", true},
		{"YES", true},
		{"on", true},
		{"ON", true},
		{"false", false},
		{"FALSE", false},
		{"0", false},
		{"no", false},
		{"off", false},
		{"", false},
	}

	for _, tt := range tests {
		os.Setenv("TEST_BOOL", tt.value)
		result := env.GetBool("TEST_BOOL")
		if result != tt.expected {
			t.Errorf("GetBool(%q) = %v, expected %v", tt.value, result, tt.expected)
		}
	}
	os.Unsetenv("TEST_BOOL")
}

func TestEnv_GetBoolDefault(t *testing.T) {
	os.Unsetenv("NON_EXISTENT_BOOL")

	if env.GetBool("NON_EXISTENT_BOOL") != false {
		t.Error("Expected false for non-existent bool without default")
	}

	if env.GetBool("NON_EXISTENT_BOOL", true) != true {
		t.Error("Expected true for non-existent bool with default true")
	}
}

func TestEnv_GetInt(t *testing.T) {
	os.Setenv("TEST_INT", "42")
	defer os.Unsetenv("TEST_INT")

	value := env.GetInt("TEST_INT")
	if value != 42 {
		t.Errorf("Expected 42, got %d", value)
	}
}

func TestEnv_GetIntDefault(t *testing.T) {
	os.Unsetenv("NON_EXISTENT_INT")

	value := env.GetInt("NON_EXISTENT_INT", 100)
	if value != 100 {
		t.Errorf("Expected 100, got %d", value)
	}
}

func TestEnv_GetIntInvalid(t *testing.T) {
	os.Setenv("INVALID_INT", "not_a_number")
	defer os.Unsetenv("INVALID_INT")

	value := env.GetInt("INVALID_INT", 50)
	if value != 50 {
		t.Errorf("Expected default 50 for invalid int, got %d", value)
	}
}

func TestEnv_GetFloat(t *testing.T) {
	os.Setenv("TEST_FLOAT", "3.14")
	defer os.Unsetenv("TEST_FLOAT")

	value := env.GetFloat("TEST_FLOAT")
	if value != 3.14 {
		t.Errorf("Expected 3.14, got %f", value)
	}
}

func TestEnv_GetSlice(t *testing.T) {
	os.Setenv("TEST_SLICE", "a,b,c,d")
	defer os.Unsetenv("TEST_SLICE")

	value := env.GetSlice("TEST_SLICE")
	expected := []string{"a", "b", "c", "d"}

	if len(value) != len(expected) {
		t.Errorf("Expected %d items, got %d", len(expected), len(value))
	}

	for i, v := range expected {
		if value[i] != v {
			t.Errorf("Expected value[%d] = %s, got %s", i, v, value[i])
		}
	}
}

func TestEnv_GetSliceWithSpaces(t *testing.T) {
	os.Setenv("TEST_SLICE_SPACES", " a , b , c ")
	defer os.Unsetenv("TEST_SLICE_SPACES")

	value := env.GetSlice("TEST_SLICE_SPACES")
	expected := []string{"a", "b", "c"}

	if len(value) != len(expected) {
		t.Errorf("Expected %d items, got %d", len(expected), len(value))
	}

	for i, v := range expected {
		if value[i] != v {
			t.Errorf("Expected value[%d] = %s, got %s", i, v, value[i])
		}
	}
}

func TestEnv_GetSliceDefault(t *testing.T) {
	os.Unsetenv("NON_EXISTENT_SLICE")

	defaultSlice := []string{"x", "y", "z"}
	value := env.GetSlice("NON_EXISTENT_SLICE", defaultSlice)

	if len(value) != len(defaultSlice) {
		t.Errorf("Expected %d items, got %d", len(defaultSlice), len(value))
	}
}

func TestEnv_Set(t *testing.T) {
	env.Set("NEW_VAR", "new_value")
	defer os.Unsetenv("NEW_VAR")

	if os.Getenv("NEW_VAR") != "new_value" {
		t.Error("Set did not work")
	}
}

func TestEnv_Unset(t *testing.T) {
	os.Setenv("TO_UNSET", "value")
	env.Unset("TO_UNSET")

	if _, exists := os.LookupEnv("TO_UNSET"); exists {
		t.Error("Unset did not work")
	}
}

func TestEnv_AppEnv(t *testing.T) {
	os.Setenv("APP_ENV", "testing")
	defer os.Unsetenv("APP_ENV")

	env.LoadFresh()
	result := env.AppEnv()
	if result != "testing" {
		t.Errorf("Expected 'testing', got '%s'", result)
	}
}

func TestEnv_IsProduction(t *testing.T) {
	tests := []struct {
		env      string
		expected bool
	}{
		{"production", true},
		{"prod", true},
		{"release", true},
		{"development", false},
		{"dev", false},
		{"testing", false},
	}

	for _, tt := range tests {
		os.Setenv("APP_ENV", tt.env)
		env.LoadFresh()
		result := env.IsProduction()
		if result != tt.expected {
			t.Errorf("IsProduction() with APP_ENV=%s: expected %v, got %v", tt.env, tt.expected, result)
		}
	}
	os.Unsetenv("APP_ENV")
}

func TestEnv_IsDevelopment(t *testing.T) {
	tests := []struct {
		env      string
		expected bool
	}{
		{"development", true},
		{"dev", true},
		{"local", true},
		{"debug", true},
		{"production", false},
		{"testing", false},
	}

	for _, tt := range tests {
		os.Setenv("APP_ENV", tt.env)
		env.LoadFresh()
		result := env.IsDevelopment()
		if result != tt.expected {
			t.Errorf("IsDevelopment() with APP_ENV=%s: expected %v, got %v", tt.env, tt.expected, result)
		}
	}
	os.Unsetenv("APP_ENV")
}

func TestEnv_IsTesting(t *testing.T) {
	os.Setenv("APP_ENV", "testing")
	defer os.Unsetenv("APP_ENV")

	env.LoadFresh()
	if !env.IsTesting() {
		t.Error("Expected IsTesting() to return true")
	}
}

func TestEnv_SystemEnvPriority(t *testing.T) {
	// System env should have highest priority
	os.Setenv("PRIORITY_TEST", "from_system")
	defer os.Unsetenv("PRIORITY_TEST")

	env.LoadFresh()

	value := env.Get("PRIORITY_TEST")
	if value != "from_system" {
		t.Errorf("Expected 'from_system', got '%s'", value)
	}
}

func TestEnv_GetOrFail(t *testing.T) {
	os.Setenv("REQUIRED_VAR", "required_value")
	defer os.Unsetenv("REQUIRED_VAR")

	value := env.GetOrFail("REQUIRED_VAR")
	if value != "required_value" {
		t.Errorf("Expected 'required_value', got '%s'", value)
	}
}

func TestEnv_GetOrFailPanic(t *testing.T) {
	os.Unsetenv("NON_EXISTENT_REQUIRED")

	defer func() {
		if r := recover(); r == nil {
			t.Error("Expected panic for missing required env var")
		}
	}()

	env.GetOrFail("NON_EXISTENT_REQUIRED")
}

func TestEnv_GetInt64(t *testing.T) {
	os.Setenv("TEST_INT64", "9223372036854775807")
	defer os.Unsetenv("TEST_INT64")

	value := env.GetInt64("TEST_INT64")
	if value != 9223372036854775807 {
		t.Errorf("Expected max int64, got %d", value)
	}
}
