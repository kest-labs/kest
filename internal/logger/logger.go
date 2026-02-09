package logger

import (
	"bytes"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"sync"

	"github.com/kest-labs/kest/internal/config"
)

var (
	currentSession *SessionLogger
	sessionMu      sync.RWMutex
)

type SessionLogger struct {
	File *os.File
	path string
}

func getLogDir() (string, error) {
	// Try project-level logging first
	conf, err := config.LoadConfig()
	if err == nil && conf.ProjectPath != "" && conf.LogEnabled {
		// Project has .kest/config.yaml and logging is enabled
		return filepath.Join(conf.ProjectPath, ".kest", "logs"), nil
	}
	// Fallback to global logging in ~/.kest/logs/
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(homeDir, ".kest", "logs"), nil
}

func sanitizeFilename(name string) string {
	safe := strings.ReplaceAll(name, "/", "_")
	safe = strings.Map(func(r rune) rune {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || r == '_' || r == '-' || r == '.' {
			return r
		}
		return -1
	}, safe)
	if len(safe) > 50 {
		return safe[:50]
	}
	return safe
}

func StartSession(name string) (*SessionLogger, error) {
	logDir, err := getLogDir()
	if err != nil {
		return nil, err
	}

	if err := os.MkdirAll(logDir, 0755); err != nil {
		return nil, err
	}

	// Primary log file for AI Editors (stable path)
	logPath := filepath.Join(logDir, "kest.log")

	f, err := os.OpenFile(logPath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
	if err != nil {
		return nil, err
	}

	sl := &SessionLogger{File: f, path: logPath}

	header := fmt.Sprintf("\n\n"+
		"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"+
		"🚀 KEST SESSION START: %s\n"+
		"⏰ Time: %s\n"+
		"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n",
		name, time.Now().Format(time.RFC3339))
	sl.File.WriteString(header)

	sessionMu.Lock()
	currentSession = sl
	sessionMu.Unlock()

	return sl, nil
}

func EndSession() {
	sessionMu.Lock()
	defer sessionMu.Unlock()
	if currentSession != nil {
		currentSession.File.WriteString(fmt.Sprintf("\n=== SESSION END: %s ===\n", time.Now().Format(time.RFC3339)))
		currentSession.File.Close()
		currentSession = nil
	}
}

func GetSessionPath() string {
	sessionMu.RLock()
	defer sessionMu.RUnlock()
	if currentSession != nil {
		return currentSession.path
	}
	return ""
}

func LogToSession(format string, args ...interface{}) {
	sessionMu.RLock()
	defer sessionMu.RUnlock()
	if currentSession != nil {
		msg := fmt.Sprintf(format, args...)
		currentSession.File.WriteString(msg + "\n")
	}
}

func LogRequest(method, url string, headers map[string]string, body string, status int, respHeaders map[string][]string, respBody string, duration time.Duration) error {
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
		logEntry += prettyJSON(body) + "\n"
	}

	logEntry += "\n--- Response Headers ---\n"
	for k, v := range respHeaders {
		logEntry += fmt.Sprintf("%s: %v\n", k, v)
	}

	logEntry += "\n--- Response Body ---\n"
	logEntry += prettyJSON(respBody) + "\n"
	logEntry += "\n"

	// Determine log destination
	var logFile *os.File
	var shouldClose bool

	sessionMu.RLock()
	if currentSession != nil {
		logFile = currentSession.File
		shouldClose = false
	}
	sessionMu.RUnlock()

	// If no session, log to kest.log by default
	if logFile == nil {
		logDir, err := getLogDir()
		if err == nil {
			os.MkdirAll(logDir, 0755)
			logPath := filepath.Join(logDir, "kest.log")
			f, err := os.OpenFile(logPath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
			if err == nil {
				logFile = f
				shouldClose = true
			}
		}
	}

	if logFile != nil {
		if shouldClose {
			defer logFile.Close()
		}
		_, _ = logFile.WriteString(logEntry)
	}

	return nil
}

func Info(format string, a ...interface{}) {
	msg := fmt.Sprintf("ℹ️  "+format, a...)
	fmt.Println(msg)
	LogToSession("%s", msg)
}

func Error(format string, a ...interface{}) {
	msg := fmt.Sprintf("❌ "+format, a...)
	fmt.Fprintln(os.Stderr, msg)
	LogToSession("%s", msg)
}

func prettyJSON(input string) string {
	var prettyJSON bytes.Buffer
	if err := json.Indent(&prettyJSON, []byte(input), "", "  "); err != nil {
		return input // Not valid JSON, return as is
	}
	return prettyJSON.String()
}
