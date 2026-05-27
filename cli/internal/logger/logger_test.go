package logger

import (
	"os"
	"strings"
	"testing"
)

func TestSessionLogging(t *testing.T) {
	sessionName := "test_session"
	sl, err := StartSession(sessionName)
	if err != nil {
		t.Fatalf("Failed to start session: %v", err)
	}
	defer sl.File.Close()

	logMsg := "Hello Kest Log"
	LogToSession("%s", logMsg)

	path := GetSessionPath()
	if path == "" {
		t.Error("Expected session path to be non-empty")
	}
	if strings.HasSuffix(path, "kest.log") {
		t.Error("Expected session path to point at a per-run log file")
	}

	content, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("Failed to read log file: %v", err)
	}

	if !strings.Contains(string(content), logMsg) {
		t.Errorf("Log content does not contain expected message: %s", logMsg)
	}

	EndSession()

	if GetSessionPath() != "" {
		t.Error("Expected session path to be empty after EndSession")
	}

	// Cleanup
	os.Remove(path)
}

func TestLogRequestRedactsSensitiveValues(t *testing.T) {
	sl, err := StartSession("redaction_test")
	if err != nil {
		t.Fatalf("Failed to start session: %v", err)
	}
	path := GetSessionPath()
	defer os.Remove(path)
	defer EndSession()

	err = LogRequest(
		"POST",
		"http://example.test/login",
		map[string]string{
			"Authorization":        "Bearer secret-token",
			"X-Internal-Signature": "hmac-secret",
			"Content-Type":         "application/json",
		},
		`{"password":"secret","access_token":"abc123","name":"visible"}`,
		200,
		map[string][]string{"Set-Cookie": []string{"session=secret"}},
		`{"refresh_token":"refresh-secret","ok":true}`,
		0,
	)
	if err != nil {
		t.Fatalf("LogRequest failed: %v", err)
	}
	sl.File.Sync()

	content, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("Failed to read log file: %v", err)
	}
	log := string(content)
	for _, secret := range []string{"secret-token", "hmac-secret", "abc123", "refresh-secret", "session=secret"} {
		if strings.Contains(log, secret) {
			t.Fatalf("expected log to redact %q, got:\n%s", secret, log)
		}
	}
	if !strings.Contains(log, `"name":"visible"`) && !strings.Contains(log, `"name": "visible"`) {
		t.Fatalf("expected non-sensitive body fields to remain visible, got:\n%s", log)
	}
}
