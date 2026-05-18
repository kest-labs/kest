package logger

import (
	"bytes"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"sync"

	"github.com/kest-labs/kest/cli/internal/config"
)

var (
	currentSession *SessionLogger
	sessionMu      sync.RWMutex
)

type SessionLogger struct {
	File       *os.File
	files      []*os.File
	path       string
	stablePath string
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

	// Primary log file for AI Editors (stable path), plus a per-run session
	// file for easier CI/debug artifact collection.
	stablePath := filepath.Join(logDir, "kest.log")
	sessionPath := filepath.Join(logDir, fmt.Sprintf("%s-%s.log",
		time.Now().Format("20060102-150405"),
		sanitizeFilename(name),
	))

	stableFile, err := os.OpenFile(stablePath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
	if err != nil {
		return nil, err
	}
	sessionFile, err := os.OpenFile(sessionPath, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0644)
	if err != nil {
		stableFile.Close()
		return nil, err
	}

	sl := &SessionLogger{
		File:       sessionFile,
		files:      []*os.File{stableFile, sessionFile},
		path:       sessionPath,
		stablePath: stablePath,
	}

	header := fmt.Sprintf("\n\n"+
		"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"+
		"🚀 KEST SESSION START: %s\n"+
		"⏰ Time: %s\n"+
		"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n",
		name, time.Now().Format(time.RFC3339))
	sl.writeString(header)

	sessionMu.Lock()
	currentSession = sl
	sessionMu.Unlock()

	return sl, nil
}

func EndSession() {
	sessionMu.Lock()
	defer sessionMu.Unlock()
	if currentSession != nil {
		currentSession.writeString(fmt.Sprintf("\n=== SESSION END: %s ===\n", time.Now().Format(time.RFC3339)))
		currentSession.close()
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
		msg := sanitizeLogText(fmt.Sprintf(format, args...))
		currentSession.writeString(msg + "\n")
	}
}

func LogRequest(method, url string, headers map[string]string, body string, status int, respHeaders map[string][]string, respBody string, duration time.Duration) error {
	timestamp := time.Now().Format("15:04:05")
	separator := "================================================================================\n"

	logEntry := fmt.Sprintf("%s [%s] %s %s\n", separator, timestamp, method, url)
	logEntry += fmt.Sprintf("Duration: %v | Status: %d\n", duration, status)

	logEntry += "\n--- Request Headers ---\n"
	for k, v := range sanitizeStringMap(headers) {
		logEntry += fmt.Sprintf("%s: %s\n", k, v)
	}

	if body != "" {
		logEntry += "\n--- Request Body ---\n"
		logEntry += prettyJSON(sanitizeLogText(body)) + "\n"
	}

	logEntry += "\n--- Response Headers ---\n"
	for k, v := range sanitizeStringSliceMap(respHeaders) {
		logEntry += fmt.Sprintf("%s: %v\n", k, v)
	}

	logEntry += "\n--- Response Body ---\n"
	logEntry += prettyJSON(sanitizeLogText(respBody)) + "\n"
	logEntry += "\n"

	// Determine log destination
	var logFiles []*os.File
	var shouldClose bool

	sessionMu.RLock()
	if currentSession != nil {
		logFiles = currentSession.files
		shouldClose = false
	}
	sessionMu.RUnlock()

	// If no session, log to kest.log by default
	if len(logFiles) == 0 {
		logDir, err := getLogDir()
		if err == nil {
			os.MkdirAll(logDir, 0755)
			logPath := filepath.Join(logDir, "kest.log")
			f, err := os.OpenFile(logPath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
			if err == nil {
				logFiles = []*os.File{f}
				shouldClose = true
			}
		}
	}

	if len(logFiles) > 0 {
		for _, logFile := range logFiles {
			if shouldClose {
				defer logFile.Close()
			}
			_, _ = logFile.WriteString(logEntry)
		}
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

func (sl *SessionLogger) writeString(value string) {
	for _, f := range sl.files {
		_, _ = f.WriteString(value)
	}
}

func (sl *SessionLogger) close() {
	for _, f := range sl.files {
		_ = f.Close()
	}
}

var (
	sensitiveHeaderPattern = regexp.MustCompile(`(?im)^([ \t]*)(authorization|proxy-authorization|cookie|set-cookie|x-api-key|x-internal-signature)(\s*:\s*)(.+)$`)
	sensitiveJSONPattern   = regexp.MustCompile(`(?i)("?(password|pass|token|access_token|refresh_token|secret|client_secret|api_key|apikey|authorization|x_internal_signature|x-internal-signature)"?\s*[:=]\s*"?)([^",\s}]+)("?)`)
)

func sanitizeStringMap(input map[string]string) map[string]string {
	if len(input) == 0 {
		return nil
	}
	out := make(map[string]string, len(input))
	for key, value := range input {
		if isSensitiveKey(key) {
			out[key] = "[REDACTED]"
			continue
		}
		out[key] = sanitizeLogText(value)
	}
	return out
}

func sanitizeStringSliceMap(input map[string][]string) map[string][]string {
	if len(input) == 0 {
		return nil
	}
	out := make(map[string][]string, len(input))
	for key, values := range input {
		if isSensitiveKey(key) {
			out[key] = []string{"[REDACTED]"}
			continue
		}
		copied := make([]string, 0, len(values))
		for _, value := range values {
			copied = append(copied, sanitizeLogText(value))
		}
		out[key] = copied
	}
	return out
}

func sanitizeLogText(value string) string {
	value = sensitiveHeaderPattern.ReplaceAllString(value, "${1}${2}${3}[REDACTED]")
	return sensitiveJSONPattern.ReplaceAllString(value, "${1}[REDACTED]${4}")
}

func isSensitiveKey(key string) bool {
	normalized := strings.ToLower(strings.TrimSpace(key))
	return normalized == "authorization" ||
		normalized == "proxy-authorization" ||
		normalized == "cookie" ||
		normalized == "set-cookie" ||
		normalized == "x-api-key" ||
		normalized == "x-internal-signature" ||
		strings.Contains(normalized, "token") ||
		strings.Contains(normalized, "secret") ||
		strings.Contains(normalized, "password") ||
		strings.Contains(normalized, "api_key") ||
		strings.Contains(normalized, "apikey")
}
