package cli

import (
	"bufio"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"github.com/kest-lab/kest-cli/internal/logger"
	"github.com/kest-lab/kest-cli/internal/summary"
	"github.com/spf13/cobra"
	"github.com/spf13/pflag"
)

var (
	runParallel bool
	runJobs     int
	runVerbose  bool
)

var runCmd = &cobra.Command{
	Use:   "run [file]",
	Short: "Run a Kest scenario file (.kest) or a Markdown flow file (.flow.md)",
	Long: `Execute API test scenarios defined in .kest or .flow.md files.
Kest Flow (.flow.md) allows you to use standard Markdown to document and test your APIs simultaneously.`,
	Example: `  # Run a single flow
  kest run login.flow.md

  # Run with parallel workers for speed
  kest run tests/ --parallel --jobs 8

  # Run a legacy .kest scenario
  kest run auth.kest`,
	Args: cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		return runScenario(args[0])
	},
}

func init() {
	runCmd.Flags().BoolVarP(&runParallel, "parallel", "p", false, "Run requests in parallel")
	runCmd.Flags().IntVarP(&runJobs, "jobs", "j", 4, "Number of parallel jobs (default: 4)")
	runCmd.Flags().BoolVarP(&runVerbose, "verbose", "v", false, "Show detailed request/response info")
	rootCmd.AddCommand(runCmd)
}

func runScenario(filePath string) error {
	logger.StartSession(filepath.Base(filePath))
	defer logger.EndSession()

	content, err := os.ReadFile(filePath)
	if err != nil {
		return err
	}

	var blocks []KestBlock
	if strings.HasSuffix(filePath, ".md") {
		blocks = ParseMarkdown(string(content))
	} else {
		// Traditional .kest parsing
		scanner := bufio.NewScanner(strings.NewReader(string(content)))
		lineNum := 0
		for scanner.Scan() {
			lineNum++
			line := strings.TrimSpace(scanner.Text())
			if line == "" || strings.HasPrefix(line, "#") {
				continue
			}
			blocks = append(blocks, KestBlock{
				LineNum: lineNum,
				Raw:     line,
				IsBlock: false,
			})
		}
	}

	fmt.Printf("\n🚀 Running %d test(s) from %s\n", len(blocks), filePath)
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
		resultChan := make(chan summary.TestResult, len(blocks))

		for _, block := range blocks {
			wg.Add(1)
			go func(kb KestBlock) {
				defer wg.Done()
				semaphore <- struct{}{}        // Acquire
				defer func() { <-semaphore }() // Release

				result := executeKestBlock(kb, false, runVerbose)
				resultChan <- result
			}(block)
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
		for _, block := range blocks {
			if block.IsBlock {
				fmt.Printf("--- Step at line %d: ---\n%s\n", block.LineNum, block.Raw)
			} else {
				fmt.Printf("--- Step %d: %s ---\n", block.LineNum, block.Raw)
			}
			result := executeKestBlock(block, true, runVerbose)
			summ.AddResult(result)
			if !result.Success {
				fmt.Printf("❌ Failed at line %d\n\n", block.LineNum)
			}
		}
	}

	summ.Print()

	if summ.FailedTests > 0 {
		return fmt.Errorf("test suite failed")
	}
	return nil
}

func executeKestBlock(kb KestBlock, showOutput bool, verbose bool) summary.TestResult {
	if kb.IsBlock {
		return executeMultiLineBlock(kb.Raw, kb.LineNum, showOutput, verbose)
	}
	return executeTestLine(kb.Raw, kb.LineNum, showOutput, verbose)
}

func executeMultiLineBlock(raw string, lineNum int, showOutput bool, verbose bool) summary.TestResult {
	result := summary.TestResult{
		Name: fmt.Sprintf("Block at line %d", lineNum),
	}

	opts, err := ParseBlock(raw)
	if err != nil {
		result.Error = fmt.Errorf("parse error at line %d: %v", lineNum, err)
		result.Success = false
		return result
	}

	result.Method = strings.ToUpper(opts.Method)
	result.URL = opts.URL
	opts.Verbose = verbose

	// Capture output if parallel
	oldStdout := os.Stdout
	if !showOutput {
		os.Stdout = nil // Suppress output in parallel mode
	}

	res, err := ExecuteRequest(opts)
	if !showOutput {
		os.Stdout = oldStdout // Restore
	}

	result.Status = res.Status
	result.Duration = res.Duration
	result.ResponseBody = res.ResponseBody
	result.StartTime = res.StartTime
	result.Success = (err == nil)
	result.Error = err

	return result
}

func executeTestLine(line string, lineNum int, showOutput bool, verbose bool) summary.TestResult {
	result := summary.TestResult{
		Name: fmt.Sprintf("Line %d", lineNum),
	}

	parts := splitArguments(line)
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

	res, err := ExecuteRequest(RequestOptions{
		Method:      method,
		URL:         url,
		Data:        data,
		Headers:     headers,
		Queries:     queries,
		Captures:    captures,
		Asserts:     asserts,
		Verbose:     verbose,
		NoRecord:    noRec,
		MaxDuration: maxDuration,
		Retry:       retry,
		RetryWait:   retryWait,
	})

	result.Status = res.Status
	result.Duration = res.Duration
	result.ResponseBody = res.ResponseBody
	result.StartTime = res.StartTime

	if !showOutput {
		os.Stdout = oldStdout // Restore
	}

	result.Success = (err == nil)
	result.Error = err

	// Note: Duration would need to be captured from ExecuteRequest
	// For now using a placeholder
	return result
}

func splitArguments(s string) []string {
	var args []string
	var current strings.Builder
	var inQuotes bool
	var quoteChar rune

	for _, r := range s {
		if inQuotes {
			if r == quoteChar {
				inQuotes = false
			} else {
				current.WriteRune(r)
			}
		} else {
			if r == '"' || r == '\'' {
				inQuotes = true
				quoteChar = r
			} else if r == ' ' || r == '\t' {
				if current.Len() > 0 {
					args = append(args, current.String())
					current.Reset()
				}
			} else {
				current.WriteRune(r)
			}
		}
	}
	if current.Len() > 0 {
		args = append(args, current.String())
	}
	return args
}
