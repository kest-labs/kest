package summary

import (
	"bytes"
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"time"
)

type TestResult struct {
	Name         string
	Method       string
	URL          string
	Status       int
	Duration     time.Duration
	StartTime    time.Time
	ResponseBody string
	Error        error
	Success      bool
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
	TotalTime   time.Duration
	StartTime   time.Time
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

	if result.Success {
		s.PassedTests++
	} else {
		s.FailedTests++
	}
}

func (s *Summary) Print() {
	elapsed := time.Since(s.StartTime)

	fmt.Println("\n╭─────────────────────────────────────────────────────────────────────╮")
	fmt.Println("│                        TEST SUMMARY                                 │")
	fmt.Println("├─────────────────────────────────────────────────────────────────────┤")

	for _, result := range s.Results {
		status := "✓"
		statusColor := "\033[32m" // Green
		if !result.Success {
			status = "✗"
			statusColor = "\033[31m" // Red
		}

		fmt.Printf("│ %s %s [%s] %-30s %6dms │\n",
			statusColor+status+"\033[0m",
			result.StartTime.Format("15:04:05"),
			result.Method,
			truncate(result.URL, 30),
			int(result.Duration.Milliseconds()))

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
	fmt.Printf("│ Total: %d  │  Passed: \033[32m%d\033[0m  │  Failed: \033[31m%d\033[0m  │  Time: %v │\n",
		s.TotalTests, s.PassedTests, s.FailedTests, s.TotalTime.Round(time.Millisecond))
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

	if s.FailedTests > 0 {
		fmt.Printf("\n\033[31m✗ %d test(s) failed\033[0m\n", s.FailedTests)
	} else {
		fmt.Printf("\n\033[32m✓ All tests passed!\033[0m\n")
	}
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
