package summary

import (
	"fmt"
	"time"
)

type TestResult struct {
	Name     string
	Method   string
	URL      string
	Status   int
	Duration time.Duration
	Error    error
	Success  bool
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

		fmt.Printf("│ %s%s\033[0m %-8s %-35s %6dms │\n",
			statusColor, status, result.Method, truncate(result.URL, 35), result.Duration.Milliseconds())

		if result.Error != nil {
			fmt.Printf("│     Error: %-56s │\n", truncate(result.Error.Error(), 56))
		}
	}

	fmt.Println("├─────────────────────────────────────────────────────────────────────┤")
	fmt.Printf("│ Total: %d  │  Passed: \033[32m%d\033[0m  │  Failed: \033[31m%d\033[0m  │  Time: %v │\n",
		s.TotalTests, s.PassedTests, s.FailedTests, s.TotalTime)
	fmt.Printf("│ Elapsed: %v                                                     │\n", elapsed.Round(time.Millisecond))
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
