package main

import (
	"bufio"
	"bytes"
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/kest-labs/kest/cli/internal/logger"
	"github.com/kest-labs/kest/cli/internal/storage"
	"github.com/kest-labs/kest/cli/internal/summary"
	"github.com/kest-labs/kest/cli/internal/variable"
	"github.com/spf13/cobra"
	"github.com/spf13/pflag"
)

var (
	runParallel  bool
	runJobs      int
	runVerbose   bool
	runDebugVars bool
	runVars      []string
	execTimeout  int
)

var runCmd = &cobra.Command{
	Use:     "run [file]",
	Aliases: []string{"r"},
	Short:   "Run a Kest scenario file (.kest) or a Markdown flow file (.flow.md)",
	Long: `Execute API test scenarios defined in .kest or .flow.md files.
Kest Flow (.flow.md) allows you to use standard Markdown to document and test your APIs simultaneously.`,
	Example: `  # Run a single flow
  kest run login.flow.md

  # Inject variables from CLI
  kest run login.flow.md --var api_key=secret --var env=prod

  # Run with parallel workers for speed
  kest run tests/ --parallel --jobs 8

  # Set exec step timeout and verbose output
  kest run hmac.flow.md --exec-timeout 10 -v --debug-vars

  # Run a legacy .kest scenario
  kest run auth.kest`,
	Args:         cobra.ExactArgs(1),
	SilenceUsage: true,
	RunE: func(cmd *cobra.Command, args []string) error {
		return runScenario(args[0])
	},
}

func init() {
	runCmd.Flags().BoolVarP(&runParallel, "parallel", "p", false, "Run requests in parallel")
	runCmd.Flags().IntVarP(&runJobs, "jobs", "j", 4, "Number of parallel jobs")
	runCmd.Flags().BoolVarP(&runVerbose, "verbose", "v", false, "Show detailed request/response info")
	runCmd.Flags().BoolVar(&runDebugVars, "debug-vars", false, "Show variable resolution details")
	runCmd.Flags().StringArrayVar(&runVars, "var", []string{}, "Set variables (e.g. --var key=value)")
	runCmd.Flags().IntVar(&execTimeout, "exec-timeout", 30, "Timeout in seconds for exec steps")
	rootCmd.AddCommand(runCmd)
}

func runScenario(filePath string) error {
	logger.StartSession(filepath.Base(filePath))
	defer logger.EndSession()

	// Parse --var flags and create a scoped RunContext
	cliVars := make(map[string]string, len(runVars))
	for _, v := range runVars {
		parts := strings.SplitN(v, "=", 2)
		if len(parts) == 2 {
			cliVars[strings.TrimSpace(parts[0])] = strings.TrimSpace(parts[1])
		}
	}
	ActiveRunCtx = NewRunContext(cliVars)
	defer func() { ActiveRunCtx = nil }()

	content, err := os.ReadFile(filePath)
	if err != nil {
		return err
	}

	var blocks []KestBlock
	if strings.HasSuffix(filePath, ".md") {
		doc, legacy := ParseFlowDocument(string(content))
		if len(doc.Steps) > 0 || len(doc.Edges) > 0 || doc.Meta.ID != "" {
			return runFlowDocument(doc, filePath)
		}
		blocks = legacy
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

	if logPath := logger.GetSessionPath(); logPath != "" {
		fmt.Printf("\n📄 Full session logs generated at: %s\n", logPath)
		fmt.Printf("💡 Tip: Use this path for deep-context debugging in AI Editors (Cursor/Windsurf)\n")
		fmt.Printf("📘 Need help writing flows? Run 'kest guide' for a quick tutorial.\n")
	}

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
	opts.DebugVars = runDebugVars

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
	fs.IntVar(&maxDuration, "max-time", 0, "")
	fs.IntVar(&retry, "retry", 0, "")
	fs.IntVar(&retryWait, "retry-delay", 1000, "")

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

func runFlowDocument(doc FlowDoc, filePath string) error {
	steps := orderFlowSteps(doc)

	fmt.Printf("\n🚀 Running %d step(s) from %s\n", len(steps), filePath)
	if runParallel {
		fmt.Printf("⚠️  Parallel mode is ignored for flow steps; running sequentially.\n\n")
	}
	fmt.Println("📝 Sequential mode")

	if len(doc.Edges) > 0 && runVerbose {
		fmt.Println("\nMermaid (flowchart):")
		fmt.Println(FlowToMermaid(doc))
	}

	summ := summary.NewSummary()
	for _, step := range steps {
		// Handle @type exec steps
		if step.Type == "exec" {
			fmt.Printf("\n  ▶ %s (exec, line %d)\n", stepName(step), step.LineNum)
			result := executeExecStep(step)
			summ.AddResult(result)
			if !result.Success {
				fmt.Printf("❌ Failed at exec step %s\n\n", stepName(step))
			}
			continue
		}

		if step.Request.Method == "" || step.Request.URL == "" {
			result := summary.TestResult{
				Name:    stepName(step),
				Success: false,
				Error:   fmt.Errorf("invalid step (missing METHOD/URL) at line %d", step.LineNum),
			}
			summ.AddResult(result)
			continue
		}
		fmt.Printf("\n  ▶ %s %s %s (line %d)\n", stepName(step), step.Request.Method, step.Request.URL, step.LineNum)

		opts := step.Request
		opts.Verbose = runVerbose
		opts.DebugVars = runDebugVars
		opts.SilentOutput = true
		if step.Retry > 0 {
			opts.Retry = step.Retry
		}
		if step.RetryWait > 0 {
			opts.RetryWait = step.RetryWait
		}
		if step.MaxDuration > 0 {
			opts.MaxDuration = step.MaxDuration
		}

		res, err := ExecuteRequest(opts)
		result := summary.TestResult{
			Name:         stepName(step),
			Method:       strings.ToUpper(opts.Method),
			URL:          opts.URL,
			Status:       res.Status,
			Duration:     res.Duration,
			ResponseBody: res.ResponseBody,
			StartTime:    res.StartTime,
			Success:      err == nil,
			Error:        err,
		}
		summ.AddResult(result)
		if err != nil {
			fmt.Printf("    ❌ Failed at step %s\n", stepName(step))
		} else {
			fmt.Printf("    ✅ %s %s → %d (%s)\n", res.Method, step.Request.URL, res.Status, res.Duration.Round(time.Millisecond))
		}
	}

	summ.Print()

	if logPath := logger.GetSessionPath(); logPath != "" {
		fmt.Printf("\n📄 Full session logs generated at: %s\n", logPath)
		fmt.Printf("💡 Tip: Use this path for deep-context debugging in AI Editors (Cursor/Windsurf)\n")
		fmt.Printf("📘 Need help writing flows? Run 'kest guide' for a quick tutorial.\n")
	}

	if summ.FailedTests > 0 {
		return fmt.Errorf("test suite failed")
	}
	return nil
}

func orderFlowSteps(doc FlowDoc) []FlowStep {
	if len(doc.Edges) == 0 {
		return doc.Steps
	}

	index := make(map[string]int, len(doc.Steps))
	for i, step := range doc.Steps {
		index[step.ID] = i
	}

	adj := make(map[string][]string)
	indeg := make(map[string]int)
	for _, step := range doc.Steps {
		if step.ID != "" {
			indeg[step.ID] = 0
		}
	}
	for _, edge := range doc.Edges {
		if edge.From == "" || edge.To == "" {
			continue
		}
		adj[edge.From] = append(adj[edge.From], edge.To)
		indeg[edge.To]++
	}

	var queue []string
	for id, d := range indeg {
		if d == 0 {
			queue = append(queue, id)
		}
	}
	queue = sortByIndex(queue, index)

	var ordered []FlowStep
	seen := make(map[string]bool)
	for len(queue) > 0 {
		id := queue[0]
		queue = queue[1:]
		if seen[id] {
			continue
		}
		seen[id] = true
		if i, ok := index[id]; ok {
			ordered = append(ordered, doc.Steps[i])
		}
		next := adj[id]
		for _, to := range next {
			indeg[to]--
			if indeg[to] == 0 {
				queue = append(queue, to)
			}
		}
		queue = sortByIndex(queue, index)
	}

	if len(ordered) != len(doc.Steps) {
		return doc.Steps
	}
	return ordered
}

// executeExecStep runs a shell command and captures output as variables.
// The full variable chain (config → captured → CLI → exec) is available
// for interpolation in the command. Captured values are stored in the
// active RunContext so subsequent steps can reference them.
func executeExecStep(step FlowStep) summary.TestResult {
	startTime := time.Now()
	result := summary.TestResult{
		Name:      stepName(step),
		Method:    "EXEC",
		StartTime: startTime,
	}

	if step.Exec.Command == "" {
		result.Success = false
		result.Error = fmt.Errorf("exec step has no command at line %d", step.LineNum)
		return result
	}

	// Build the full variable map: config → storage → run context
	vars := buildVarChain()
	command := variable.Interpolate(step.Exec.Command, vars)

	fmt.Printf("  $ %s\n", command)

	// Run with timeout and cross-platform shell
	timeout := time.Duration(execTimeout) * time.Second
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	shell, flag := ShellCommand()
	cmd := exec.CommandContext(ctx, shell, flag, command)
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	err := cmd.Run()
	duration := time.Since(startTime)
	result.Duration = duration

	if ctx.Err() == context.DeadlineExceeded {
		result.Success = false
		result.Error = fmt.Errorf("exec timed out after %ds", execTimeout)
		fmt.Printf("  ❌ %v\n", result.Error)
		return result
	}
	if err != nil {
		result.Success = false
		result.Error = fmt.Errorf("exec failed: %v\nstderr: %s", err, strings.TrimSpace(stderr.String()))
		fmt.Printf("  ❌ %v\n", result.Error)
		return result
	}

	output := strings.TrimSpace(stdout.String())
	if runVerbose && output != "" {
		fmt.Printf("  stdout: %s\n", output)
	}
	if runVerbose && stderr.Len() > 0 {
		fmt.Printf("  stderr: %s\n", strings.TrimSpace(stderr.String()))
	}

	// Process captures
	for _, capExpr := range step.Exec.Captures {
		varName, query, ok := ParseCaptureExpr(capExpr)
		if !ok {
			continue
		}

		value := ResolveExecCapture(output, query)
		if value != "" {
			if ActiveRunCtx != nil {
				ActiveRunCtx.Set(varName, value)
			}
			fmt.Printf("  Captured: %s = %s\n", varName, value)
			logger.LogToSession("Exec Captured: %s = %s", varName, value)
		} else {
			fmt.Printf("  ⚠️  Capture '%s' produced empty value\n", varName)
		}
	}

	result.Success = true
	result.ResponseBody = output
	fmt.Printf("  ✅ Exec completed in %s\n", duration.Round(time.Millisecond))
	return result
}

// buildVarChain assembles the full variable map following the priority chain:
// config env vars → storage captured vars → run context (CLI + exec captures).
func buildVarChain() map[string]string {
	vars := make(map[string]string)

	conf := loadConfigWarn()
	if conf != nil {
		env := conf.GetActiveEnv()
		if env.Variables != nil {
			for k, v := range env.Variables {
				vars[k] = v
			}
		}
	}

	store, _ := storage.NewStore()
	if store != nil {
		defer store.Close()
		if conf != nil {
			capturedVars, _ := store.GetVariables(conf.ProjectID, conf.ActiveEnv)
			for k, v := range capturedVars {
				vars[k] = v
			}
		}
	}

	if ActiveRunCtx != nil {
		for k, v := range ActiveRunCtx.All() {
			vars[k] = v
		}
	}

	return vars
}

func sortByIndex(ids []string, index map[string]int) []string {
	for i := 0; i < len(ids); i++ {
		for j := i + 1; j < len(ids); j++ {
			if index[ids[j]] < index[ids[i]] {
				ids[i], ids[j] = ids[j], ids[i]
			}
		}
	}
	return ids
}

func stepName(step FlowStep) string {
	if step.Name != "" {
		return step.Name
	}
	if step.ID != "" {
		return step.ID
	}
	return "step"
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
