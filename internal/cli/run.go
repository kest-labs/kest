package cli

import (
	"bufio"
	"fmt"
	"os"
	"strings"
	"sync"

	"github.com/kest-lab/kest-cli/internal/summary"
	"github.com/spf13/cobra"
	"github.com/spf13/pflag"
)

var (
	runParallel bool
	runJobs     int
)

var runCmd = &cobra.Command{
	Use:   "run [file]",
	Short: "Run a Kest scenario file (.kest)",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		return runScenario(args[0])
	},
}

func init() {
	runCmd.Flags().BoolVarP(&runParallel, "parallel", "p", false, "Run requests in parallel")
	runCmd.Flags().IntVarP(&runJobs, "jobs", "j", 4, "Number of parallel jobs (default: 4)")
	rootCmd.AddCommand(runCmd)
}

func runScenario(filePath string) error {
	file, err := os.Open(filePath)
	if err != nil {
		return err
	}
	defer file.Close()

	// Parse all lines first
	type testCase struct {
		line    string
		lineNum int
	}

	var tests []testCase
	scanner := bufio.NewScanner(file)
	lineNum := 0
	for scanner.Scan() {
		lineNum++
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		tests = append(tests, testCase{line: line, lineNum: lineNum})
	}

	if err := scanner.Err(); err != nil {
		return err
	}

	fmt.Printf("\n🚀 Running %d test(s) from %s\n", len(tests), filePath)
	if runParallel {
		fmt.Printf("⚡ Parallel mode: %d workers\n\n", runJobs)
	} else {
		fmt.Println("📝 Sequential mode")
	}

	summ := summary.NewSummary()

	if runParallel {
		// Parallel execution
		var wg sync.WaitGroup
		semaphore := make(chan struct{}, runJobs)
		resultChan := make(chan summary.TestResult, len(tests))

		for _, test := range tests {
			wg.Add(1)
			go func(tc testCase) {
				defer wg.Done()
				semaphore <- struct{}{}        // Acquire
				defer func() { <-semaphore }() // Release

				result := executeTestLine(tc.line, tc.lineNum, false)
				resultChan <- result
			}(test)
		}

		// Wait and close channel
		go func() {
			wg.Wait()
			close(resultChan)
		}()

		// Collect results
		for result := range resultChan {
			summ.AddResult(result)
		}
	} else {
		// Sequential execution
		for _, test := range tests {
			fmt.Printf("--- Step %d: %s ---\n", test.lineNum, test.line)
			result := executeTestLine(test.line, test.lineNum, true)
			summ.AddResult(result)
			if !result.Success {
				fmt.Printf("❌ Failed at line %d\n\n", test.lineNum)
			}
		}
	}

	summ.Print()

	if summ.FailedTests > 0 {
		return fmt.Errorf("test suite failed")
	}
	return nil
}

func executeTestLine(line string, lineNum int, showOutput bool) summary.TestResult {
	result := summary.TestResult{
		Name: fmt.Sprintf("Line %d", lineNum),
	}

	parts := strings.Fields(line)
	if len(parts) < 2 {
		result.Error = fmt.Errorf("invalid command format")
		result.Success = false
		return result
	}

	method := strings.ToLower(parts[0])
	url := parts[1]
	result.Method = strings.ToUpper(method)
	result.URL = url

	// Parse flags
	fs := pflag.NewFlagSet("scenario", pflag.ContinueOnError)
	var data string
	var headers, queries, captures, asserts []string
	var noRec bool
	var maxDuration, retry, retryWait int

	fs.StringVarP(&data, "data", "d", "", "")
	fs.StringSliceVarP(&headers, "header", "H", []string{}, "")
	fs.StringSliceVarP(&queries, "query", "q", []string{}, "")
	fs.StringSliceVarP(&captures, "capture", "c", []string{}, "")
	fs.StringSliceVarP(&asserts, "assert", "a", []string{}, "")
	fs.BoolVar(&noRec, "no-record", false, "")
	fs.IntVar(&maxDuration, "max-duration", 0, "")
	fs.IntVar(&retry, "retry", 0, "")
	fs.IntVar(&retryWait, "retry-wait", 1000, "")

	err := fs.Parse(parts[2:])
	if err != nil {
		result.Error = err
		result.Success = false
		return result
	}

	// Capture output if parallel
	oldStdout := os.Stdout
	if !showOutput {
		os.Stdout = nil // Suppress output in parallel mode
	}

	err = ExecuteRequest(RequestOptions{
		Method:      method,
		URL:         url,
		Data:        data,
		Headers:     headers,
		Queries:     queries,
		Captures:    captures,
		Asserts:     asserts,
		NoRecord:    noRec,
		MaxDuration: maxDuration,
		Retry:       retry,
		RetryWait:   retryWait,
	})

	if !showOutput {
		os.Stdout = oldStdout // Restore
	}

	result.Success = (err == nil)
	result.Error = err

	// Note: Duration would need to be captured from ExecuteRequest
	// For now using a placeholder
	return result
}
