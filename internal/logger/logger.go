package logger

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/kest-lab/kest-cli/internal/config"
)

func LogRequest(method, url string, headers map[string]string, body string, status int, respHeaders map[string][]string, respBody string, duration time.Duration) error {
	var logDir string

	// Try project-level logging first
	conf, err := config.LoadConfig()
	if err == nil && conf.ProjectPath != "" && conf.LogEnabled {
		// Project has .kest/config.yaml and logging is enabled
		logDir = filepath.Join(conf.ProjectPath, ".kest", "logs")
	} else {
		// Fallback to global logging in ~/.kest/logs/
		homeDir, err := os.UserHomeDir()
		if err != nil {
			return nil // Silently skip if we can't determine home dir
		}
		logDir = filepath.Join(homeDir, ".kest", "logs")
	}

	if err := os.MkdirAll(logDir, 0755); err != nil {
		return err
	}

	// Generate a unique filename: 2006-01-02_15-04-05_METHOD_PATH.log
	// Sanitize path for filename
	baseURL := ""
	if conf != nil && conf.GetActiveEnv().BaseURL != "" {
		baseURL = conf.GetActiveEnv().BaseURL
	}
	safePath := strings.ReplaceAll(strings.TrimPrefix(url, baseURL), "/", "_")
	safePath = strings.Map(func(r rune) rune {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || r == '_' || r == '-' {
			return r
		}
		return -1
	}, safePath)
	if len(safePath) > 30 {
		safePath = safePath[:30]
	}

	filename := fmt.Sprintf("%s_%s%s.log",
		time.Now().Format("2006-01-02_15-04-05"),
		strings.ToUpper(method),
		safePath,
	)
	logPath := filepath.Join(logDir, filename)

	f, err := os.OpenFile(logPath, os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		return err
	}
	defer f.Close()

	timestamp := time.Now().Format("15:04:05")
	separator := "================================================================================\n"

	logEntry := fmt.Sprintf("%s [%s] %s %s\n", separator, timestamp, method, url)
	logEntry += fmt.Sprintf("Duration: %v | Status: %d\n", duration, status)

	logEntry += "\n--- Request Headers ---\n"
	for k, v := range headers {
		logEntry += fmt.Sprintf("%s: %s\n", k, v)
	}

	if body != "" {
		logEntry += "\n--- Request Body ---\n"
		logEntry += body + "\n"
	}

	logEntry += "\n--- Response Headers ---\n"
	for k, v := range respHeaders {
		logEntry += fmt.Sprintf("%s: %v\n", k, v)
	}

	logEntry += "\n--- Response Body ---\n"
	logEntry += respBody + "\n"
	logEntry += "\n"

	_, err = f.WriteString(logEntry)
	return err
}
func Info(format string, a ...interface{}) {
	fmt.Printf("ℹ️  "+format+"\n", a...)
}

func Error(format string, a ...interface{}) {
	fmt.Fprintf(os.Stderr, "❌ "+format+"\n", a...)
}
