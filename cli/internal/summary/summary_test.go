package summary

import (
	"bytes"
	"encoding/json"
	"errors"
	"strings"
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

func TestSkippedResultsAreNotFailures(t *testing.T) {
	s := NewSummary()
	s.AddResult(TestResult{Name: "Create", Success: false, Error: errors.New("assertion failed: status == 201")})
	s.AddResult(TestResult{Name: "Read", Skipped: true, SkipReason: "depends on Create which failed", SkippedBecause: "Create"})
	s.AddResult(TestResult{Name: "Update", Skipped: true, SkipReason: "depends on Create which failed", SkippedBecause: "Create"})
	s.AddResult(TestResult{Name: "Health", Success: true})

	if s.FailedTests != 1 || s.SkippedTests != 2 || s.PassedTests != 1 || s.TotalTests != 4 {
		t.Fatalf("unexpected counters: %+v", s)
	}
	if s.RecordedSkips() != 2 {
		t.Fatalf("RecordedSkips = %d", s.RecordedSkips())
	}
	verdict := s.verdict()
	for _, want := range []string{"1 failed", "2 skipped", "caused by Create (2)", "Root cause:"} {
		if !strings.Contains(verdict, want) {
			t.Fatalf("verdict missing %q:\n%s", want, verdict)
		}
	}
}
