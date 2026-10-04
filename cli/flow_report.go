package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/kest-labs/kest/cli/internal/output"
	"github.com/kest-labs/kest/cli/internal/summary"
)

type flowSuiteResult struct {
	Profile     string
	Environment string
	BaseURL     string
	StartedAt   time.Time
	FinishedAt  time.Time
	Files       []runExecutionResult
}

type flowJSONReport struct {
	Profile      string               `json:"profile"`
	Environment  string               `json:"environment,omitempty"`
	BaseURL      string               `json:"base_url,omitempty"`
	StartedAt    string               `json:"started_at"`
	FinishedAt   string               `json:"finished_at"`
	TotalFlows   int                  `json:"total_flows"`
	PassedFlows  int                  `json:"passed_flows"`
	FailedFlows  int                  `json:"failed_flows"`
	TotalSteps   int                  `json:"total_steps"`
	PassedSteps  int                  `json:"passed_steps"`
	FailedSteps  int                  `json:"failed_steps"`
	SkippedSteps int                  `json:"skipped_steps,omitempty"`
	DurationMs   int64                `json:"duration_ms"`
	Flows        []flowJSONFileReport `json:"flows"`
}

type flowJSONFileReport struct {
	SourcePath   string                 `json:"source_path"`
	SourceName   string                 `json:"source_name"`
	FlowID       string                 `json:"flow_id,omitempty"`
	FlowName     string                 `json:"flow_name,omitempty"`
	Status       string                 `json:"status"`
	Error        string                 `json:"error,omitempty"`
	TotalSteps   int                    `json:"total_steps"`
	PassedSteps  int                    `json:"passed_steps"`
	FailedSteps  int                    `json:"failed_steps"`
	SkippedSteps int                    `json:"skipped_steps,omitempty"`
	DurationMs   int64                  `json:"duration_ms"`
	Steps        []flowJSONStepReport   `json:"steps"`
	Metadata     map[string]interface{} `json:"metadata,omitempty"`
}

type flowJSONStepReport struct {
	StepID         string `json:"step_id,omitempty"`
	Name           string `json:"name"`
	Method         string `json:"method"`
	URL            string `json:"url,omitempty"`
	Status         int    `json:"http_status,omitempty"`
	Success        bool   `json:"success"`
	Skipped        bool   `json:"skipped,omitempty"`
	SkippedBecause string `json:"skipped_because,omitempty"`
	Phase          string `json:"phase,omitempty"`
	DurationMs     int64  `json:"duration_ms"`
	StartedAt      string `json:"started_at,omitempty"`
	Error          string `json:"error,omitempty"`
}

func writeFlowReports(suite flowSuiteResult, targets flowReportTargets) error {
	if targets.JSON != "" {
		if err := writeFlowJSONReport(suite, targets.JSON); err != nil {
			return err
		}
		fmt.Printf("\n📊 JSON flow report written to: %s\n", targets.JSON)
	}
	if targets.JUnit != "" {
		if err := writeFlowJUnitReport(suite, targets.JUnit); err != nil {
			return err
		}
		fmt.Printf("📊 JUnit flow report written to: %s\n", targets.JUnit)
	}
	return nil
}

func writeFlowJSONReport(suite flowSuiteResult, path string) error {
	report := buildFlowJSONReport(suite)
	content, err := json.MarshalIndent(report, "", "  ")
	if err != nil {
		return err
	}
	return writeReportFile(path, append(content, '\n'))
}

func buildFlowJSONReport(suite flowSuiteResult) flowJSONReport {
	report := flowJSONReport{
		Profile:     suite.Profile,
		Environment: suite.Environment,
		BaseURL:     suite.BaseURL,
		StartedAt:   suite.StartedAt.UTC().Format(time.RFC3339),
		FinishedAt:  suite.FinishedAt.UTC().Format(time.RFC3339),
		TotalFlows:  len(suite.Files),
		Flows:       make([]flowJSONFileReport, 0, len(suite.Files)),
	}

	for _, file := range suite.Files {
		fileReport := buildFlowJSONFileReport(file)
		report.TotalSteps += fileReport.TotalSteps
		report.PassedSteps += fileReport.PassedSteps
		report.FailedSteps += fileReport.FailedSteps
		report.SkippedSteps += fileReport.SkippedSteps
		if fileReport.Status == "passed" {
			report.PassedFlows++
		} else {
			report.FailedFlows++
		}
		report.DurationMs += fileReport.DurationMs
		report.Flows = append(report.Flows, fileReport)
	}

	return report
}

func buildFlowJSONFileReport(file runExecutionResult) flowJSONFileReport {
	report := flowJSONFileReport{
		SourcePath: file.SourcePath,
		SourceName: filepath.Base(file.SourcePath),
		FlowID:     file.FlowID,
		FlowName:   file.FlowName,
		Status:     file.Status(),
		Steps:      []flowJSONStepReport{},
	}
	if file.Err != nil {
		report.Error = file.Err.Error()
	}
	if file.Summary == nil {
		return report
	}

	report.TotalSteps = file.Summary.TotalTests
	report.PassedSteps = file.Summary.PassedTests
	report.FailedSteps = file.Summary.FailedTests
	report.SkippedSteps = file.Summary.SkippedTests
	report.DurationMs = file.Summary.TotalTime.Milliseconds()
	report.Steps = make([]flowJSONStepReport, 0, len(file.Summary.Results))
	for _, result := range file.Summary.Results {
		report.Steps = append(report.Steps, buildFlowJSONStepReport(result))
	}
	return report
}

func buildFlowJSONStepReport(result summary.TestResult) flowJSONStepReport {
	item := flowJSONStepReport{
		StepID:     result.StepID,
		Name:       result.Name,
		Method:     result.Method,
		URL:        result.URL,
		Status:     result.Status,
		Success:    result.Success,
		Skipped:    result.Skipped,
		Phase:      result.Phase,
		DurationMs: result.Duration.Milliseconds(),
	}
	if result.Skipped {
		item.SkippedBecause = result.SkippedBecause
		item.Error = result.SkipReason
	}
	if !result.StartTime.IsZero() {
		item.StartedAt = result.StartTime.UTC().Format(time.RFC3339)
	}
	if result.Error != nil {
		item.Error = result.Error.Error()
	}
	return item
}

// writeFlowJUnitReport renders the suite through the versioned result so
// --junit / --report-junit and --json always agree.
func writeFlowJUnitReport(suite flowSuiteResult, path string) error {
	return output.WriteJUnitFile(path, buildRunResult(suite.Files, suite.StartedAt, suite.FinishedAt))
}

func writeReportFile(path string, content []byte) error {
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return err
	}
	return os.WriteFile(path, content, 0644)
}

func summaryDuration(summ *summary.Summary) time.Duration {
	if summ == nil {
		return 0
	}
	return summ.TotalTime
}
