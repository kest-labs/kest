package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/kest-labs/kest/cli/internal/summary"
)

func TestWriteFlowReports(t *testing.T) {
	dir := t.TempDir()
	summ := summary.NewSummary()
	summ.StartTime = time.Unix(1700000000, 0).UTC()
	summ.AddResult(summary.TestResult{
		StepID:    "health",
		Name:      "health",
		Method:    "GET",
		URL:       "http://127.0.0.1:5119/v1/health",
		Status:    200,
		Success:   true,
		Duration:  25 * time.Millisecond,
		StartTime: summ.StartTime,
	})

	suite := flowSuiteResult{
		Profile:     "local",
		Environment: "local",
		BaseURL:     "http://127.0.0.1:5119",
		StartedAt:   summ.StartTime,
		FinishedAt:  summ.StartTime.Add(summ.TotalTime),
		Files: []runExecutionResult{{
			SourcePath: "health.flow.md",
			Summary:    summ,
			StartedAt:  summ.StartTime,
			FinishedAt: summ.StartTime.Add(summ.TotalTime),
		}},
	}

	jsonPath := filepath.Join(dir, "flow-results.json")
	junitPath := filepath.Join(dir, "flow-results.xml")
	if err := writeFlowReports(suite, flowReportTargets{JSON: jsonPath, JUnit: junitPath}); err != nil {
		t.Fatalf("writeFlowReports returned error: %v", err)
	}

	jsonContent, err := os.ReadFile(jsonPath)
	if err != nil {
		t.Fatalf("read json report: %v", err)
	}
	if !strings.Contains(string(jsonContent), `"total_flows": 1`) || !strings.Contains(string(jsonContent), `"passed_steps": 1`) {
		t.Fatalf("unexpected json report: %s", jsonContent)
	}

	junitContent, err := os.ReadFile(junitPath)
	if err != nil {
		t.Fatalf("read junit report: %v", err)
	}
	if !strings.Contains(string(junitContent), `<testsuites`) || !strings.Contains(string(junitContent), `tests="1"`) {
		t.Fatalf("unexpected junit report: %s", junitContent)
	}
}
