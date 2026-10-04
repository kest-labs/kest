package main

import (
	"encoding/xml"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

type parsedJUnit struct {
	Tests    int `xml:"tests,attr"`
	Failures int `xml:"failures,attr"`
	Errors   int `xml:"errors,attr"`
	Suites   []struct {
		Name      string `xml:"name,attr"`
		Tests     int    `xml:"tests,attr"`
		Failures  int    `xml:"failures,attr"`
		TestCases []struct {
			Name    string `xml:"name,attr"`
			Failure *struct {
				Type    string `xml:"type,attr"`
				Message string `xml:"message,attr"`
				Text    string `xml:",chardata"`
			} `xml:"failure"`
		} `xml:"testcase"`
	} `xml:"testsuite"`
}

func TestRunJUnitReportFromResult(t *testing.T) {
	work := isolateKest(t)
	server := newAPIServer(t)
	passName := writeFlow(t, work, "health.flow.md", passingFlow)
	failName := writeFlow(t, work, "items.flow.md", failingFlow)

	junitPath := filepath.Join(work, "reports", "junit.xml")
	runReportJUnit = junitPath
	if _, err := runJSON(t, []string{passName, failName}, server.URL); err == nil {
		t.Fatal("expected the failing flow to fail the run")
	}

	content, err := os.ReadFile(junitPath)
	if err != nil {
		t.Fatalf("read junit: %v", err)
	}
	if strings.Contains(string(content), "super-secret-token") || strings.Contains(string(content), "leaked-secret") {
		t.Fatalf("secrets leaked into JUnit report:\n%s", content)
	}

	var report parsedJUnit
	if err := xml.Unmarshal(content, &report); err != nil {
		t.Fatalf("invalid JUnit XML: %v\n%s", err, content)
	}
	if report.Tests != 3 || report.Failures != 1 || report.Errors != 0 || len(report.Suites) != 2 {
		t.Fatalf("unexpected totals: %+v\n%s", report, content)
	}
	failing := report.Suites[1]
	if failing.Name != "items.flow.md" || failing.Tests != 2 || failing.Failures != 1 {
		t.Fatalf("unexpected failing suite: %+v", failing)
	}
	failure := failing.TestCases[1].Failure
	if failure == nil || failure.Type != "assertion" || !strings.Contains(failure.Text, "Failed assertion: status == 201") {
		t.Fatalf("unexpected failure element: %+v", failure)
	}
	if !strings.Contains(failure.Text, "name is required") {
		t.Fatalf("expected response excerpt in failure text: %q", failure.Text)
	}
}

func TestRunJUnitReportWhenRunCannotStart(t *testing.T) {
	work := isolateKest(t)
	junitPath := filepath.Join(work, "junit.xml")
	runReportJUnit = junitPath
	if _, err := runJSON(t, []string{"missing.flow.md"}, ""); err == nil {
		t.Fatal("expected an error for a missing flow")
	}

	content, err := os.ReadFile(junitPath)
	if err != nil {
		t.Fatalf("expected a JUnit report even when the run cannot start: %v", err)
	}
	var report parsedJUnit
	if err := xml.Unmarshal(content, &report); err != nil {
		t.Fatalf("invalid JUnit XML: %v\n%s", err, content)
	}
	if report.Tests != 1 || report.Errors != 1 {
		t.Fatalf("expected one errored test case, got %+v\n%s", report, content)
	}
}
