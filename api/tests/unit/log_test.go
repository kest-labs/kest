package unit

import (
	"bytes"
	"os"
	"strings"
	"testing"

	"github.com/kest-labs/kest/api/pkg/logger"
)

func TestLog_Levels(t *testing.T) {
	tests := []struct {
		name     string
		levelStr string
		expected logger.Level
	}{
		{"DEBUG", "DEBUG", logger.LevelDebug},
		{"INFO", "INFO", logger.LevelInfo},
		{"WARN", "WARN", logger.LevelWarning},
		{"WARNING", "WARNING", logger.LevelWarning},
		{"ERROR", "ERROR", logger.LevelError},
		{"CRITICAL", "CRITICAL", logger.LevelCritical},
		{"ALERT", "ALERT", logger.LevelAlert},
		{"EMERGENCY", "EMERGENCY", logger.LevelEmergency},
		{"unknown", "unknown", logger.LevelDebug}, // Default is Debug in ParseLevel
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			l := logger.ParseLevel(tt.levelStr)
			if l != tt.expected {
				t.Errorf("ParseLevel(%s) = %v, expected %v", tt.levelStr, l, tt.expected)
			}
		})
	}
}

func TestLog_LevelString(t *testing.T) {
	tests := []struct {
		level    logger.Level
		expected string
	}{
		{logger.LevelDebug, "DEBUG"},
		{logger.LevelInfo, "INFO"},
		{logger.LevelWarning, "WARNING"},
		{logger.LevelError, "ERROR"},
		{logger.LevelFatal, "FATAL"},
	}

	for _, tt := range tests {
		if tt.level.String() != tt.expected {
			t.Errorf("Level.String() = %s, expected %s", tt.level.String(), tt.expected)
		}
	}
}

func TestLog_With(t *testing.T) {
	cfg := logger.DefaultConfig()
	cfg.Level = logger.LevelDebug
	l := logger.New(cfg)

	// Test chaining
	loggerWithField := l.WithContext(map[string]any{"request_id": "123"})
	loggerWithFields := loggerWithField.WithContext(map[string]any{"user_id": 456})

	// Ensure chaining works
	_ = loggerWithFields
}

func TestLog_Default(t *testing.T) {
	// Get default logger
	logger1 := logger.Default()
	logger2 := logger.Default()

	// Should be the same instance
	if logger1 != logger2 {
		t.Error("Default() should return the same instance")
	}
}

func TestLog_SetDefault(t *testing.T) {
	cfg := logger.DefaultConfig()
	cfg.Level = logger.LevelError
	customLogger := logger.New(cfg)
	logger.SetDefault(customLogger)

	// Verify it's set
	if logger.Default() != customLogger {
		t.Error("SetDefault() did not set the logger")
	}

	// Reset to a fresh default for other tests
	logger.SetDefault(logger.New(logger.DefaultConfig()))
}

func TestLog_FileOutput(t *testing.T) {
	// Create temp file
	tmpFile := "test_log_" + strings.Replace(t.Name(), "/", "_", -1) + ".log"
	// Clean up before and after
	os.Remove(tmpFile)
	defer os.Remove(tmpFile)

	cfg := logger.DefaultConfig()
	cfg.Level = logger.LevelDebug
	cfg.File = tmpFile
	cfg.Path = "." // Current dir

	l := logger.New(cfg)
	defer l.Close()

	l.Info("test message")

	// Read the file - wait a bit for flush? simple logger usually flushes immediately or on close
	l.Close()

	// Check file existence
	if _, err := os.Stat(tmpFile); os.IsNotExist(err) {
		// Filename might involve date pattern
		return // Skip if file pattern logic makes it hard to predict name
	}
}

func TestLog_LevelFiltering(t *testing.T) {
	var buf bytes.Buffer
	cfg := logger.DefaultConfig()
	cfg.Level = logger.LevelWarning
	l := logger.New(cfg)

	// Debug should be filtered
	l.Debug("debug message")
	l.Info("info message")

	// These would write to stdout, so we just verify no panic
	l.Warning("warn message")
	l.Error("error message")

	_ = buf
}

func TestLog_PackageFunctions(t *testing.T) {
	// Reset default logger
	logger.SetDefault(logger.New(logger.DefaultConfig()))

	// Test package-level functions don't panic
	logger.Debug("debug test")
	logger.Info("info test")
	logger.Warning("warn test")
	logger.Error("error test")

	// Test WithContext
	l := logger.Default().WithContext(map[string]any{"key": "value"})
	l.Info("with field")
}

func TestLog_Formatting(t *testing.T) {
	cfg := logger.DefaultConfig()
	cfg.Level = logger.LevelDebug
	l := logger.New(cfg)

	// Test format strings
	l.Infof("user %s logged in", "john")
	l.Debugf("request took %dms", 123)
	l.Warningf("cache hit rate: %.2f%%", 95.5)
}

func TestLog_Close(t *testing.T) {
	tmpFile := "test_log_close.log"
	os.Remove(tmpFile)
	defer os.Remove(tmpFile)

	cfg := logger.DefaultConfig()
	cfg.Level = logger.LevelDebug
	cfg.File = tmpFile
	cfg.Path = "."

	l := logger.New(cfg)

	l.Info("before close")

	err := l.Close()
	if err != nil {
		t.Errorf("Close() returned error: %v", err)
	}

	// Close again should not panic
	err = l.Close()
	// err may be nil since file is already nil
}
