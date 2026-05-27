package summary

import (
	"bytes"
	"encoding/json"
	"testing"
	"time"
)

func TestWriteJSONIncludesRunAndStepDetails(t *testing.T) {
	s := NewSummary()
	s.AddResult(TestResult{
		Name:            "register",
		StepID:          "step-register",
		Method:          "POST",
		URL:             "http://example.test/register",
		Status:          201,
		Duration:        25 * time.Millisecond,
		StartTime:       time.Unix(100, 0).UTC(),
		RequestID:       "req-123",
		Captures:        map[string]string{"user_id": "u1"},
		FailedAssertion: "",
		Success:         true,
	})

	var buf bytes.Buffer
	if err := s.WriteJSON(&buf, "flow.md", ".kest/logs/session.log"); err != nil {
		t.Fatalf("WriteJSON failed: %v", err)
	}

	var payload RunJSON
	if err := json.Unmarshal(buf.Bytes(), &payload); err != nil {
		t.Fatalf("invalid JSON output: %v\n%s", err, buf.String())
	}
	if payload.SourcePath != "flow.md" || payload.LogPath != ".kest/logs/session.log" {
		t.Fatalf("unexpected metadata: %#v", payload)
	}
	if payload.Total != 1 || payload.Passed != 1 || payload.Failed != 0 {
		t.Fatalf("unexpected counts: %#v", payload)
	}
	if len(payload.Results) != 1 {
		t.Fatalf("expected one result, got %d", len(payload.Results))
	}
	result := payload.Results[0]
	if result.StepID != "step-register" || result.RequestID != "req-123" {
		t.Fatalf("missing step details: %#v", result)
	}
	if result.Captures["user_id"] != "u1" {
		t.Fatalf("missing captures: %#v", result.Captures)
	}
}
