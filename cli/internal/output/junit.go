package output

import (
	"encoding/json"
	"encoding/xml"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
)

type junitTestSuites struct {
	XMLName  xml.Name         `xml:"testsuites"`
	Name     string           `xml:"name,attr"`
	Tests    int              `xml:"tests,attr"`
	Failures int              `xml:"failures,attr"`
	Errors   int              `xml:"errors,attr"`
	Skipped  int              `xml:"skipped,attr"`
	Time     string           `xml:"time,attr"`
	Suites   []junitTestSuite `xml:"testsuite"`
}

type junitTestSuite struct {
	Name      string          `xml:"name,attr"`
	Tests     int             `xml:"tests,attr"`
	Failures  int             `xml:"failures,attr"`
	Errors    int             `xml:"errors,attr"`
	Skipped   int             `xml:"skipped,attr"`
	Time      string          `xml:"time,attr"`
	TestCases []junitTestCase `xml:"testcase"`
}

type junitTestCase struct {
	ClassName string        `xml:"classname,attr"`
	Name      string        `xml:"name,attr"`
	Time      string        `xml:"time,attr"`
	Failure   *junitProblem `xml:"failure,omitempty"`
	Error     *junitProblem `xml:"error,omitempty"`
	Skipped   *junitSkipped `xml:"skipped,omitempty"`
}

type junitSkipped struct {
	Message string `xml:"message,attr,omitempty"`
}

type junitProblem struct {
	Message string `xml:"message,attr"`
	Type    string `xml:"type,attr,omitempty"`
	Text    string `xml:",chardata"`
}

// WriteJUnit renders the result as JUnit XML. Steps are grouped into one
// test suite per source file. Assertion and snapshot failures become
// <failure> elements; every other error kind becomes an <error> element.
// Skipped steps are reported as <skipped/> test cases; steps that were never
// reached (--fail-fast, interrupts) only add to the skipped count.
func WriteJUnit(w io.Writer, r *Result) error {
	report := junitTestSuites{
		Name: "kest " + r.Command,
		Time: millisToSeconds(r.Summary.DurationMs),
	}

	stepSkips := 0
	suiteIndex := map[string]int{}
	suiteMs := map[int]int64{}
	var totalMs int64
	for _, step := range r.Steps {
		source := step.Source
		if source == "" {
			source = "kest"
		}
		idx, ok := suiteIndex[source]
		if !ok {
			idx = len(report.Suites)
			suiteIndex[source] = idx
			report.Suites = append(report.Suites, junitTestSuite{Name: filepath.Base(source)})
		}
		suite := &report.Suites[idx]
		suiteMs[idx] += step.DurationMs
		totalMs += step.DurationMs

		tc := junitTestCase{
			ClassName: source,
			Name:      junitCaseName(step),
			Time:      millisToSeconds(step.DurationMs),
		}
		if step.Outcome == OutcomeSkipped {
			tc.Skipped = &junitSkipped{Message: step.SkipReason}
			suite.Skipped++
			stepSkips++
		} else if !step.OK {
			problem := &junitProblem{Message: "step failed", Text: junitFailureText(step)}
			kind := ErrorKindInternal
			if step.Error != nil {
				problem.Message = step.Error.Message
				kind = step.Error.Kind
			}
			problem.Type = kind
			if kind == ErrorKindAssertion || kind == ErrorKindSnapshot {
				tc.Failure = problem
				suite.Failures++
			} else {
				tc.Error = problem
				suite.Errors++
			}
		}
		suite.Tests++
		suite.TestCases = append(suite.TestCases, tc)
	}

	// A command-level error without a failing step still has to fail CI.
	if r.Error != nil && !hasFailedStep(r) {
		report.Suites = append(report.Suites, junitTestSuite{
			Name:   "kest",
			Tests:  1,
			Errors: 1,
			TestCases: []junitTestCase{{
				ClassName: "kest",
				Name:      r.Command,
				Time:      "0.000",
				Error:     &junitProblem{Message: r.Error.Message, Type: r.Error.Kind, Text: r.Error.Message},
			}},
		})
	}

	for i := range report.Suites {
		suite := &report.Suites[i]
		suite.Time = millisToSeconds(suiteMs[i])
		report.Tests += suite.Tests
		report.Failures += suite.Failures
		report.Errors += suite.Errors
	}
	if r.Summary.DurationMs == 0 {
		report.Time = millisToSeconds(totalMs)
	}
	// Skipped steps that were never reported as test cases (never reached
	// after --fail-fast or an interrupt) are only counted.
	report.Skipped = stepSkips
	if unreported := r.Summary.Skipped - stepSkips; unreported > 0 {
		report.Skipped += unreported
		if len(report.Suites) == 1 {
			report.Suites[0].Skipped += unreported
		}
	}

	if _, err := io.WriteString(w, xml.Header); err != nil {
		return err
	}
	encoder := xml.NewEncoder(w)
	encoder.Indent("", "  ")
	if err := encoder.Encode(report); err != nil {
		return err
	}
	_, err := io.WriteString(w, "\n")
	return err
}

// WriteJUnitFile writes the JUnit report to path, creating parent folders.
func WriteJUnitFile(path string, r *Result) error {
	if dir := filepath.Dir(path); dir != "" {
		if err := os.MkdirAll(dir, 0o755); err != nil {
			return err
		}
	}
	file, err := os.Create(path)
	if err != nil {
		return err
	}
	if err := WriteJUnit(file, r); err != nil {
		_ = file.Close()
		return err
	}
	return file.Close()
}

func hasFailedStep(r *Result) bool {
	for _, step := range r.Steps {
		if !step.OK && step.Outcome != OutcomeSkipped {
			return true
		}
	}
	return false
}

func junitCaseName(step Step) string {
	name := step.Name
	if name == "" {
		name = strings.TrimSpace(step.Method + " " + step.URL)
	}
	if step.Method != "" && step.URL != "" && !strings.Contains(name, step.URL) {
		name = fmt.Sprintf("%s (%s %s)", name, step.Method, step.URL)
	}
	return name
}

// junitFailureText lists failed assertions and a response excerpt so the
// CI test view is enough to understand the failure.
func junitFailureText(step Step) string {
	var b strings.Builder
	if step.Error != nil {
		b.WriteString(step.Error.Message)
		b.WriteString("\n")
	}
	if step.Method != "" || step.URL != "" {
		fmt.Fprintf(&b, "\nRequest: %s %s\n", step.Method, step.URL)
	}
	if step.Status > 0 {
		fmt.Fprintf(&b, "Status: %d\n", step.Status)
	}
	for _, a := range step.Assertions {
		if a.OK {
			continue
		}
		fmt.Fprintf(&b, "Failed assertion: %s\n", a.Expr)
		if a.Message != "" {
			fmt.Fprintf(&b, "  %s\n", strings.ReplaceAll(a.Message, "\n", "\n  "))
		}
	}
	if step.Response != nil && step.Response.Body != nil {
		var body string
		switch typed := step.Response.Body.(type) {
		case json.RawMessage:
			body = string(typed)
		case string:
			body = typed
		default:
			encoded, _ := json.Marshal(typed)
			body = string(encoded)
		}
		if len(body) > 2000 {
			body = body[:2000] + "..."
		}
		fmt.Fprintf(&b, "\nResponse body:\n%s\n", body)
	}
	if step.RecordID > 0 {
		fmt.Fprintf(&b, "\nInspect with: kest show %d\n", step.RecordID)
	}
	return strings.TrimSpace(b.String())
}

func millisToSeconds(ms int64) string {
	if ms < 0 {
		ms = 0
	}
	return fmt.Sprintf("%.3f", float64(ms)/1000)
}
