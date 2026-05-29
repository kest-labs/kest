package main

import (
	"encoding/json"
	"encoding/xml"
	"fmt"
	"os"
	"path/filepath"
	"time"

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
	Profile     string               `json:"profile"`
	Environment string               `json:"environment,omitempty"`
	BaseURL     string               `json:"base_url,omitempty"`
	StartedAt   string               `json:"started_at"`
	FinishedAt  string               `json:"finished_at"`
	TotalFlows  int                  `json:"total_flows"`
	PassedFlows int                  `json:"passed_flows"`
	FailedFlows int                  `json:"failed_flows"`
	TotalSteps  int                  `json:"total_steps"`
	PassedSteps int                  `json:"passed_steps"`
	FailedSteps int                  `json:"failed_steps"`
	DurationMs  int64                `json:"duration_ms"`
	Flows       []flowJSONFileReport `json:"flows"`
}

type flowJSONFileReport struct {
	SourcePath  string                 `json:"source_path"`
	SourceName  string                 `json:"source_name"`
	FlowID      string                 `json:"flow_id,omitempty"`
	FlowName    string                 `json:"flow_name,omitempty"`
	Status      string                 `json:"status"`
	Error       string                 `json:"error,omitempty"`
	TotalSteps  int                    `json:"total_steps"`
	PassedSteps int                    `json:"passed_steps"`
	FailedSteps int                    `json:"failed_steps"`
	DurationMs  int64                  `json:"duration_ms"`
	Steps       []flowJSONStepReport   `json:"steps"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

type flowJSONStepReport struct {
	StepID     string `json:"step_id,omitempty"`
	Name       string `json:"name"`
	Method     string `json:"method"`
	URL        string `json:"url,omitempty"`
	Status     int    `json:"http_status,omitempty"`
	Success    bool   `json:"success"`
	DurationMs int64  `json:"duration_ms"`
	StartedAt  string `json:"started_at,omitempty"`
	Error      string `json:"error,omitempty"`
}

type junitTestSuites struct {
	XMLName  xml.Name         `xml:"testsuites"`
	Tests    int              `xml:"tests,attr"`
	Failures int              `xml:"failures,attr"`
	Time     string           `xml:"time,attr"`
	Suites   []junitTestSuite `xml:"testsuite"`
}

type junitTestSuite struct {
	Name      string          `xml:"name,attr"`
	Tests     int             `xml:"tests,attr"`
	Failures  int             `xml:"failures,attr"`
	Time      string          `xml:"time,attr"`
	TestCases []junitTestCase `xml:"testcase"`
}

type junitTestCase struct {
	ClassName string        `xml:"classname,attr"`
	Name      string        `xml:"name,attr"`
	Time      string        `xml:"time,attr"`
	Failure   *junitFailure `xml:"failure,omitempty"`
}

type junitFailure struct {
	Message string `xml:"message,attr"`
	Text    string `xml:",chardata"`
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
		DurationMs: result.Duration.Milliseconds(),
	}
	if !result.StartTime.IsZero() {
		item.StartedAt = result.StartTime.UTC().Format(time.RFC3339)
	}
	if result.Error != nil {
		item.Error = result.Error.Error()
	}
	return item
}

func writeFlowJUnitReport(suite flowSuiteResult, path string) error {
	report := junitTestSuites{}
	duration := suite.FinishedAt.Sub(suite.StartedAt)
	if duration < 0 {
		duration = 0
	}
	report.Time = secondsString(duration)

	for _, file := range suite.Files {
		testSuite := junitTestSuite{
			Name: filepath.Base(file.SourcePath),
			Time: secondsString(summaryDuration(file.Summary)),
		}

		if file.Summary == nil {
			testSuite.Tests = 1
			testSuite.Failures = 1
			testSuite.TestCases = append(testSuite.TestCases, junitTestCase{
				ClassName: file.SourcePath,
				Name:      "load",
				Time:      "0.000",
				Failure:   &junitFailure{Message: fileErrorString(file), Text: fileErrorString(file)},
			})
		} else {
			for _, result := range file.Summary.Results {
				tc := junitTestCase{
					ClassName: file.SourcePath,
					Name:      result.Name,
					Time:      secondsString(result.Duration),
				}
				if !result.Success {
					msg := "step failed"
					if result.Error != nil {
						msg = result.Error.Error()
					}
					tc.Failure = &junitFailure{Message: msg, Text: msg}
					testSuite.Failures++
				}
				testSuite.Tests++
				testSuite.TestCases = append(testSuite.TestCases, tc)
			}
		}

		report.Tests += testSuite.Tests
		report.Failures += testSuite.Failures
		report.Suites = append(report.Suites, testSuite)
	}

	content, err := xml.MarshalIndent(report, "", "  ")
	if err != nil {
		return err
	}
	content = append([]byte(xml.Header), content...)
	content = append(content, '\n')
	return writeReportFile(path, content)
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

func secondsString(duration time.Duration) string {
	if duration < 0 {
		duration = 0
	}
	return fmt.Sprintf("%.3f", duration.Seconds())
}

func fileErrorString(file runExecutionResult) string {
	if file.Err != nil {
		return file.Err.Error()
	}
	return "flow failed"
}
