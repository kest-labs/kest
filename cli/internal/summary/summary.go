package summary

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"sort"
	"strings"
	"time"
)

type TestResult struct {
	StepID          string
	Name            string
	Method          string
	URL             string
	RequestHeaders  map[string]string
	RequestBody     string
	Status          int
	ResponseHeaders map[string][]string
	Duration        time.Duration
	StartTime       time.Time
	ResponseBody    string
	RecordID        int64
	RequestID       string
	Captures        map[string]string
	FailedAssertion string
	Command         string
	Error           error
	// ErrorKind classifies Error for machine-readable output
	// (e.g. "assertion", "network", "variable", "config", "exec", "timeout").
	ErrorKind string
	// Assertions holds the outcome of every evaluated assertion, in order.
	Assertions []AssertionResult
	// Success is true only for steps that ran and passed. Skipped steps have
	// Success == false and Skipped == true; they are not failures.
	Success bool

	// Phase is the flow block the step came from: "setup", "step" or "teardown".
	Phase string
	// Skipped marks a step that was not executed because something it depends
	// on failed or was skipped itself.
	Skipped bool
	// SkipReason is the human-readable reason a step was skipped.
	SkipReason string
	// SkippedBecause names the root-cause step (the one that actually failed).
	SkippedBecause string
	// SkippedBecauseID is the ID of the root-cause step.
	SkippedBecauseID string
}

// AssertionResult is the outcome of a single assertion expression.
type AssertionResult struct {
	Expr    string
	Passed  bool
	Message string
	Soft    bool
}

func latencyStats(results []TestResult) (time.Duration, time.Duration) {
	if len(results) == 0 {
		return 0, 0
	}
	values := make([]time.Duration, 0, len(results))
	var slowest time.Duration
	for _, r := range results {
		values = append(values, r.Duration)
		if r.Duration > slowest {
			slowest = r.Duration
		}
	}
	sort.Slice(values, func(i, j int) bool { return values[i] < values[j] })
	idx := int(float64(len(values)-1) * 0.95)
	if idx < 0 {
		idx = 0
	}
	if idx >= len(values) {
		idx = len(values) - 1
	}
	return slowest, values[idx]
}

type Summary struct {
	Results     []TestResult
	TotalTests  int
	PassedTests int
	FailedTests int
	// SkippedTests counts steps that were not executed: dependency skips
	// (recorded in Results with Skipped set) and steps never reached after
	// --fail-fast or an interrupt (counted only).
	SkippedTests int
	TotalTime    time.Duration
	StartTime    time.Time
}

func NewSummary() *Summary {
	return &Summary{
		Results:   make([]TestResult, 0),
		StartTime: time.Now(),
	}
}

func (s *Summary) AddResult(result TestResult) {
	s.Results = append(s.Results, result)
	s.TotalTests++
	s.TotalTime += result.Duration

	switch {
	case result.Skipped:
		s.SkippedTests++
	case result.Success:
		s.PassedTests++
	default:
		s.FailedTests++
	}
}

// RecordedSkips returns the number of skipped steps present in Results.
func (s *Summary) RecordedSkips() int {
	n := 0
	for _, r := range s.Results {
		if r.Skipped {
			n++
		}
	}
	return n
}

// skipRoots returns the root-cause step names of skipped results with the
// number of steps each one caused to be skipped, in first-seen order.
func (s *Summary) skipRoots() ([]string, map[string]int) {
	var order []string
	counts := map[string]int{}
	for _, r := range s.Results {
		if !r.Skipped || r.SkippedBecause == "" {
			continue
		}
		if _, ok := counts[r.SkippedBecause]; !ok {
			order = append(order, r.SkippedBecause)
		}
		counts[r.SkippedBecause]++
	}
	return order, counts
}

func (s *Summary) Print() {
	elapsed := time.Since(s.StartTime)

	fmt.Println("\n╭─────────────────────────────────────────────────────────────────────╮")
	fmt.Println("│                        TEST SUMMARY                                 │")
	fmt.Println("├─────────────────────────────────────────────────────────────────────┤")

	for _, result := range s.Results {
		status := "✓"
		statusColor := "\033[32m" // Green
		if result.Skipped {
			status = "○"
			statusColor = "\033[33m" // Yellow
		} else if !result.Success {
			status = "✗"
			statusColor = "\033[31m" // Red
		}

		started := "--:--:--"
		if !result.StartTime.IsZero() {
			started = result.StartTime.Format("15:04:05")
		}
		fmt.Printf("│ %s %s [%s] %-30s %6dms │\n",
			statusColor+status+"\033[0m",
			started,
			result.Method,
			truncate(result.URL, 30),
			int(result.Duration.Milliseconds()))

		if result.Skipped {
			fmt.Printf("│     Skipped: %-54s │\n", truncate(result.SkipReason, 54))
			continue
		}
		if result.Error != nil {
			fmt.Printf("│     Error: %-56s │\n", truncate(result.Error.Error(), 56))
			if result.ResponseBody != "" {
				lines := strings.Split(prettyJSON(result.ResponseBody), "\n")
				maxLines := 5
				if len(lines) > maxLines {
					lines = append(lines[:maxLines], "...")
				}
				fmt.Printf("│     Response Body Sample:                                            │\n")
				for _, line := range lines {
					fmt.Printf("│       %-62s │\n", truncate(line, 62))
				}
			}
		}
	}

	fmt.Println("├─────────────────────────────────────────────────────────────────────┤")
	if s.SkippedTests > 0 {
		fmt.Printf("│ Total: %d  │  Passed: \033[32m%d\033[0m  │  Failed: \033[31m%d\033[0m  │  Skipped: \033[33m%d\033[0m  │  Time: %v │\n",
			s.TotalTests, s.PassedTests, s.FailedTests, s.SkippedTests, s.TotalTime.Round(time.Millisecond))
	} else {
		fmt.Printf("│ Total: %d  │  Passed: \033[32m%d\033[0m  │  Failed: \033[31m%d\033[0m  │  Time: %v │\n",
			s.TotalTests, s.PassedTests, s.FailedTests, s.TotalTime.Round(time.Millisecond))
	}
	fmt.Printf("│ Elapsed: %-58v │\n", elapsed.Round(time.Millisecond))
	if len(s.Results) > 0 {
		slowest, p95 := latencyStats(s.Results)
		fmt.Printf("│ Slowest: %-8v │ P95: %-8v │ Total: %-24v │\n",
			slowest.Round(time.Millisecond),
			p95.Round(time.Millisecond),
			s.TotalTime.Round(time.Millisecond),
		)
	}
	fmt.Println("╰─────────────────────────────────────────────────────────────────────╯")

	fmt.Print(s.verdict())
}

// verdict renders the closing lines. When steps were skipped because a step
// they depend on failed, the root cause is named so one broken step does not
// read as a wall of failures.
func (s *Summary) verdict() string {
	var b strings.Builder
	switch {
	case s.FailedTests > 0 && s.SkippedTests > 0:
		fmt.Fprintf(&b, "\n\033[31m✗ %d failed\033[0m, \033[33m%d skipped\033[0m", s.FailedTests, s.SkippedTests)
		if roots, counts := s.skipRoots(); len(roots) > 0 {
			parts := make([]string, 0, len(roots))
			for _, root := range roots {
				parts = append(parts, fmt.Sprintf("%s (%d)", root, counts[root]))
			}
			fmt.Fprintf(&b, " (caused by %s)", strings.Join(parts, ", "))
		}
		b.WriteString("\n")
	case s.FailedTests > 0:
		fmt.Fprintf(&b, "\n\033[31m✗ %d test(s) failed\033[0m\n", s.FailedTests)
	case s.SkippedTests > 0:
		fmt.Fprintf(&b, "\n\033[32m✓ All executed tests passed\033[0m (\033[33m%d skipped\033[0m)\n", s.SkippedTests)
	default:
		b.WriteString("\n\033[32m✓ All tests passed!\033[0m\n")
	}
	if roots, _ := s.skipRoots(); len(roots) > 0 {
		for _, root := range roots {
			for _, r := range s.Results {
				if r.Success || r.Skipped || r.Name != root {
					continue
				}
				msg := "failed"
				if r.Error != nil {
					msg = strings.SplitN(strings.TrimSpace(r.Error.Error()), "\n", 2)[0]
				}
				fmt.Fprintf(&b, "  \033[31mRoot cause:\033[0m %s - %s\n", root, msg)
				break
			}
		}
	}
	return b.String()
}

type RunJSON struct {
	SourcePath  string           `json:"source_path,omitempty"`
	LogPath     string           `json:"log_path,omitempty"`
	Total       int              `json:"total"`
	Passed      int              `json:"passed"`
	Failed      int              `json:"failed"`
	Skipped     int              `json:"skipped,omitempty"`
	TotalMs     int64            `json:"total_ms"`
	ElapsedMs   int64            `json:"elapsed_ms"`
	GeneratedAt string           `json:"generated_at"`
	Results     []TestResultJSON `json:"results"`
}

type TestResultJSON struct {
	Name            string            `json:"name"`
	StepID          string            `json:"step_id,omitempty"`
	Method          string            `json:"method,omitempty"`
	URL             string            `json:"url,omitempty"`
	Status          int               `json:"status,omitempty"`
	Success         bool              `json:"success"`
	DurationMs      int64             `json:"duration_ms"`
	StartTime       string            `json:"start_time,omitempty"`
	RequestID       string            `json:"request_id,omitempty"`
	RecordID        int64             `json:"record_id,omitempty"`
	Captures        map[string]string `json:"captures,omitempty"`
	FailedAssertion string            `json:"failed_assertion,omitempty"`
	Error           string            `json:"error,omitempty"`
	Command         string            `json:"command,omitempty"`
	Skipped         bool              `json:"skipped,omitempty"`
	SkippedBecause  string            `json:"skipped_because,omitempty"`
	SkipReason      string            `json:"skip_reason,omitempty"`
}

func (s *Summary) PrintJSON(sourcePath, logPath string) {
	_ = s.WriteJSON(os.Stdout, sourcePath, logPath)
}

func (s *Summary) WriteJSON(w io.Writer, sourcePath, logPath string) error {
	elapsed := time.Since(s.StartTime)
	payload := RunJSON{
		SourcePath:  sourcePath,
		LogPath:     logPath,
		Total:       s.TotalTests,
		Passed:      s.PassedTests,
		Failed:      s.FailedTests,
		Skipped:     s.SkippedTests,
		TotalMs:     s.TotalTime.Milliseconds(),
		ElapsedMs:   elapsed.Milliseconds(),
		GeneratedAt: time.Now().Format(time.RFC3339),
		Results:     make([]TestResultJSON, 0, len(s.Results)),
	}
	for _, result := range s.Results {
		item := TestResultJSON{
			Name:            result.Name,
			StepID:          result.StepID,
			Method:          result.Method,
			URL:             result.URL,
			Status:          result.Status,
			Success:         result.Success,
			DurationMs:      result.Duration.Milliseconds(),
			RequestID:       result.RequestID,
			RecordID:        result.RecordID,
			Captures:        result.Captures,
			FailedAssertion: result.FailedAssertion,
			Command:         result.Command,
			Skipped:         result.Skipped,
			SkippedBecause:  result.SkippedBecause,
			SkipReason:      result.SkipReason,
		}
		if !result.StartTime.IsZero() {
			item.StartTime = result.StartTime.Format(time.RFC3339)
		}
		if result.Error != nil {
			item.Error = result.Error.Error()
		}
		payload.Results = append(payload.Results, item)
	}
	encoder := json.NewEncoder(w)
	encoder.SetIndent("", "  ")
	return encoder.Encode(payload)
}

func truncate(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	if maxLen <= 3 {
		return s[:maxLen]
	}
	return s[:maxLen-3] + "..."
}

func prettyJSON(input string) string {
	var prettyJSON bytes.Buffer
	if err := json.Indent(&prettyJSON, []byte(input), "", "  "); err != nil {
		return input // Not valid JSON, return as is
	}
	return prettyJSON.String()
}
