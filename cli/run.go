package main

import (
	"bufio"
	"bytes"
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/kest-labs/kest/cli/internal/logger"
	"github.com/kest-labs/kest/cli/internal/platformsync"
	"github.com/kest-labs/kest/cli/internal/report"
	"github.com/kest-labs/kest/cli/internal/storage"
	"github.com/kest-labs/kest/cli/internal/summary"
	"github.com/kest-labs/kest/cli/internal/variable"
	"github.com/spf13/cobra"
	"github.com/spf13/pflag"
	"github.com/tidwall/gjson"
)

var (
	runParallel  bool
	runJobs      int
	runVerbose   bool
	runDebugVars bool
	runVars      []string
	execTimeout  int
	runFailFast  bool
	runStrict    bool
	runEnv       string
	runHTML      bool
	runOpen      bool
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

  # Generate an HTML report
  kest run login.flow.md --html

  # Generate and open the HTML report in your browser
  kest run login.flow.md --open

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
	runCmd.Flags().BoolVar(&runFailFast, "fail-fast", false, "Stop execution on first failed step")
	runCmd.Flags().BoolVar(&runStrict, "strict", false, "Enable strict variable validation (error on undefined variables)")
	runCmd.Flags().StringVarP(&runEnv, "env", "e", "", "Override active environment for this run (e.g. staging, production)")
	runCmd.Flags().BoolVar(&runHTML, "html", false, "Generate an HTML report after the run")
	runCmd.Flags().BoolVar(&runOpen, "open", false, "Generate and open an HTML report after the run")
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

	logPath := logger.GetSessionPath()
	if logPath != "" {
		fmt.Printf("\n📄 Full session logs generated at: %s\n", logPath)
		fmt.Printf("💡 Tip: Use this path for deep-context debugging in AI Editors (Cursor/Windsurf)\n")
		fmt.Printf("📘 Need help writing flows? Run 'kest guide' for a quick tutorial.\n")
	}

	reportErr := maybeGenerateRunReport(filePath, summ, logPath)
	maybeQueueRunHistory(filePath, summ, logPath)
	if summ.FailedTests > 0 {
		if reportErr != nil {
			return fmt.Errorf("test suite failed (also failed to generate HTML report: %w)", reportErr)
		}
		return fmt.Errorf("test suite failed")
	}
	if reportErr != nil {
		return reportErr
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
	opts.SkipHistorySync = true

	// Capture output if parallel — use devnull to avoid race on os.Stdout
	var devNull *os.File
	if !showOutput {
		devNull, _ = os.Open(os.DevNull)
		oldStdout := os.Stdout
		os.Stdout = devNull
		defer func() {
			os.Stdout = oldStdout
			devNull.Close()
		}()
	}

	res, err := ExecuteRequest(opts)
	result = res
	result.Name = fmt.Sprintf("Block at line %d", lineNum)
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

	// Capture output if parallel — use devnull to avoid race on os.Stdout
	if !showOutput {
		devNull, _ := os.Open(os.DevNull)
		oldStdout := os.Stdout
		os.Stdout = devNull
		defer func() {
			os.Stdout = oldStdout
			devNull.Close()
		}()
	}

	res, err := ExecuteRequest(RequestOptions{
		Method:          method,
		URL:             url,
		Data:            data,
		Headers:         headers,
		Queries:         queries,
		Captures:        captures,
		Asserts:         asserts,
		Verbose:         verbose,
		NoRecord:        noRec,
		MaxDuration:     maxDuration,
		Retry:           retry,
		RetryWait:       retryWait,
		SkipHistorySync: true,
	})
	result = res
	result.Name = fmt.Sprintf("Line %d", lineNum)
	result.Success = (err == nil)
	result.Error = err

	return result
}

func runFlowDocument(doc FlowDoc, filePath string) error {
	// Apply @env from flow metadata if not already overridden by --env flag
	if doc.Meta.Env != "" && runEnv == "" {
		runEnv = doc.Meta.Env
		defer func() { runEnv = "" }()
	}

	steps := orderFlowSteps(doc)
	setupSteps := doc.Setup
	teardownSteps := doc.Teardown

	totalSteps := len(setupSteps) + len(steps) + len(teardownSteps)
	fmt.Printf("\n🚀 Running %d step(s) from %s\n", totalSteps, filePath)
	if runParallel {
		fmt.Printf("⚠️  Parallel mode is ignored for flow steps; running sequentially.\n\n")
	}
	fmt.Println("📝 Sequential mode")

	if len(doc.Edges) > 0 && runVerbose {
		fmt.Println("\nMermaid (flowchart):")
		fmt.Println(FlowToMermaid(doc))
	}

	summ := summary.NewSummary()
	captureOrigins := make(map[string]string)
	failedSteps := make(map[string]bool)

	registerCaptureOrigins := func(step FlowStep) {
		for _, capExpr := range step.Request.Captures {
			varName, _, ok := ParseCaptureExpr(capExpr)
			if ok && varName != "" {
				captureOrigins[varName] = stepName(step)
			}
		}
		for _, capExpr := range step.Exec.Captures {
			varName, _, ok := ParseCaptureExpr(capExpr)
			if ok && varName != "" {
				captureOrigins[varName] = stepName(step)
			}
		}
	}

	for _, step := range append(append([]FlowStep{}, setupSteps...), append(steps, teardownSteps...)...) {
		registerCaptureOrigins(step)
	}

	runStep := func(step FlowStep, i int, total int) bool {
		if step.WaitMs > 0 {
			fmt.Printf("\n  ⏳ %s waiting %dms before execution\n", stepName(step), step.WaitMs)
			time.Sleep(time.Duration(step.WaitMs) * time.Millisecond)
		}

		if err := validateFlowStepVariables(step, captureOrigins, failedSteps); err != nil {
			result := summary.TestResult{
				Name:    stepName(step),
				Method:  strings.ToUpper(step.Request.Method),
				URL:     step.Request.URL,
				Success: false,
				Error:   err,
			}
			summ.AddResult(result)
			failedSteps[stepName(step)] = true
			fmt.Printf("\n  ▶ %s (line %d)\n", stepName(step), step.LineNum)
			fmt.Printf("    ❌ %v\n", err)
			return !runFailFast
		}

		// Handle @type exec steps
		if step.Type == "exec" {
			fmt.Printf("\n  ▶ %s (exec, line %d)\n", stepName(step), step.LineNum)
			result := executeExecStep(step)
			summ.AddResult(result)
			if !result.Success {
				failedSteps[stepName(step)] = true
				fmt.Printf("❌ Failed at exec step %s\n\n", stepName(step))
				if runFailFast {
					fmt.Printf("\n⚠️  Stopping execution (--fail-fast enabled)\n")
					fmt.Printf("   Failed step: %s\n", stepName(step))
					if i+1 < total {
						fmt.Printf("   Skipped %d remaining step(s)\n", total-i-1)
					}
					return false
				}
			}
			return true
		}

		if step.Request.Method == "" || step.Request.URL == "" {
			result := summary.TestResult{
				Name:    stepName(step),
				Success: false,
				Error:   fmt.Errorf("invalid step (missing METHOD/URL) at line %d", step.LineNum),
			}
			summ.AddResult(result)
			failedSteps[stepName(step)] = true
			if runFailFast {
				fmt.Printf("\n⚠️  Stopping execution (--fail-fast enabled)\n")
				fmt.Printf("   Failed step: %s (invalid step)\n", stepName(step))
				if i+1 < total {
					fmt.Printf("   Skipped %d remaining step(s)\n", total-i-1)
				}
				return false
			}
			return true
		}
		fmt.Printf("\n  ▶ %s %s %s (line %d)\n", stepName(step), step.Request.Method, step.Request.URL, step.LineNum)

		opts := step.Request
		opts.Verbose = runVerbose
		opts.DebugVars = runDebugVars
		opts.StrictVars = true
		opts.SilentOutput = true
		opts.SkipHistorySync = true
		if step.Retry > 0 {
			opts.Retry = step.Retry
		}
		if step.RetryWait > 0 {
			opts.RetryWait = step.RetryWait
		}
		if step.MaxDuration > 0 {
			opts.MaxDuration = step.MaxDuration
		}

		res, err := executeFlowStepWithPoll(step, opts)
		result := res
		result.Name = stepName(step)
		result.Success = (err == nil)
		result.Error = err
		summ.AddResult(result)

		// Process captures after successful request
		if err == nil && len(step.Request.Captures) > 0 {
			store, _ := storage.NewStore() //nolint: we need a fresh store per capture block
			conf := loadConfigWarn()
			for _, capExpr := range step.Request.Captures {
				sep := "="
				if !strings.Contains(capExpr, "=") && strings.Contains(capExpr, ":") {
					sep = ":"
				}
				parts := strings.SplitN(capExpr, sep, 2)
				if len(parts) == 2 {
					varName := strings.TrimSpace(parts[0])
					query := strings.TrimSpace(parts[1])

					captureResult := gjson.Get(string(res.ResponseBody), query)
					if captureResult.Exists() {
						value := captureResult.String()
						// Save to ActiveRunCtx
						if ActiveRunCtx != nil {
							ActiveRunCtx.Set(varName, value)
						}
						// Also save to storage for persistence
						if store != nil && conf != nil {
							store.SaveVariable(&storage.Variable{
								Name:        varName,
								Value:       value,
								Environment: conf.ActiveEnv,
								Project:     conf.ProjectID,
							})
						}
						fmt.Printf("    Captured: %s = %s\n", varName, value)
						logger.LogToSession("Captured: %s = %s", varName, value)
					}
				}
			}
			if store != nil {
				store.Close()
			}
		}

		if err != nil {
			failedSteps[stepName(step)] = true
			fmt.Printf("    ❌ Failed at step %s\n", stepName(step))
			if runFailFast {
				fmt.Printf("\n⚠️  Stopping execution (--fail-fast enabled)\n")
				fmt.Printf("   Failed step: %s\n", stepName(step))
				fmt.Printf("   Reason: %v\n", err)
				if i+1 < total {
					fmt.Printf("   Skipped %d remaining step(s)\n", total-i-1)
				}
				return false
			}
		} else {
			fmt.Printf("    ✅ %s %s → %d (%s)\n", res.Method, step.Request.URL, res.Status, res.Duration.Round(time.Millisecond))
		}
		return true
	}

	combined := append(append([]FlowStep{}, setupSteps...), append(steps, teardownSteps...)...)
	for i, step := range combined {
		if !runStep(step, i, len(combined)) {
			break
		}
	}

	summ.Print()

	logPath := logger.GetSessionPath()
	if logPath != "" {
		fmt.Printf("\n📄 Full session logs generated at: %s\n", logPath)
		fmt.Printf("💡 Tip: Use this path for deep-context debugging in AI Editors (Cursor/Windsurf)\n")
		fmt.Printf("📘 Need help writing flows? Run 'kest guide' for a quick tutorial.\n")
	}

	reportErr := maybeGenerateRunReport(filePath, summ, logPath)
	maybeQueueRunHistory(filePath, summ, logPath)
	if summ.FailedTests > 0 {
		if reportErr != nil {
			return fmt.Errorf("test suite failed (also failed to generate HTML report: %w)", reportErr)
		}
		return fmt.Errorf("test suite failed")
	}
	if reportErr != nil {
		return reportErr
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
	result.Command = step.Exec.Command

	// Build the full variable map: config → storage → run context
	vars := buildVarChain()
	command := variable.Interpolate(step.Exec.Command, vars)

	fmt.Printf("  $ %s\n", command)

	// Use per-step timeout if set (@timeout directive), otherwise fall back to global --exec-timeout
	timeoutSec := execTimeout
	if step.ExecTimeoutMs > 0 {
		timeoutSec = step.ExecTimeoutMs / 1000
		if step.ExecTimeoutMs%1000 != 0 {
			timeoutSec++ // round up to nearest second
		}
	}
	timeout := time.Duration(timeoutSec) * time.Second
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

func maybeGenerateRunReport(filePath string, summ *summary.Summary, logPath string) error {
	if !runHTML && !runOpen {
		return nil
	}

	reportPath, err := report.WriteRunHTML(summ, report.RunHTMLOptions{
		SourcePath: filePath,
		LogPath:    logPath,
	})
	if err != nil {
		return err
	}

	fmt.Printf("\n🌐 HTML report generated at: %s\n", reportPath)
	if !runOpen {
		return nil
	}

	if err := openReportInBrowser(reportPath); err != nil {
		return fmt.Errorf("report generated at %s, but failed to open it: %w", reportPath, err)
	}

	fmt.Println("   Opened in your default browser.")
	return nil
}

func maybeQueueRunHistory(filePath string, summ *summary.Summary, logPath string) {
	conf := loadConfigWarn()
	if !platformsync.HistoryAutoSyncEnabled(conf) {
		return
	}

	store, err := storage.NewStore()
	if err != nil {
		logger.LogToSession("history auto-sync run summary skipped: %v", err)
		return
	}
	defer store.Close()

	if err := platformsync.QueueRunHistory(conf, store, filePath, summ, logPath); err != nil {
		logger.LogToSession("history auto-sync run summary enqueue failed: %v", err)
		return
	}
	platformsync.MaybeFlushHistoryOutbox(conf, store, 5)
}

func validateFlowStepVariables(step FlowStep, captureOrigins map[string]string, failedSteps map[string]bool) error {
	vars := buildVarChain()
	missing := make(map[string]struct{})

	collect := func(text string) {
		for _, name := range variable.ExtractPlaceholders(text) {
			if _, ok := vars[name]; !ok {
				missing[name] = struct{}{}
			}
		}
	}

	collect(step.Request.URL)
	collect(step.Request.Data)
	for _, h := range step.Request.Headers {
		collect(h)
	}
	for _, q := range step.Request.Queries {
		collect(q)
	}
	for _, a := range step.Request.Asserts {
		collect(a)
	}
	for _, a := range step.Request.SoftAsserts {
		collect(a)
	}
	collect(step.Exec.Command)

	if len(missing) == 0 {
		return nil
	}

	names := make([]string, 0, len(missing))
	for name := range missing {
		names = append(names, name)
	}
	sort.Strings(names)

	name := names[0]
	origin, hasOrigin := captureOrigins[name]
	if hasOrigin {
		if failedSteps[origin] {
			return fmt.Errorf("variable '%s' was not captured (%s failed)", name, origin)
		}
		return fmt.Errorf("variable '%s' was not captured (expected from %s)", name, origin)
	}
	return fmt.Errorf("required variable '%s' not provided", name)
}

func executeFlowStepWithPoll(step FlowStep, opts RequestOptions) (summary.TestResult, error) {
	hardAsserts := append([]string{}, opts.Asserts...)
	pollOpts := opts
	pollOpts.Asserts = nil

	if step.PollTimeoutMs <= 0 {
		res, err := ExecuteRequest(pollOpts)
		if err != nil {
			return res, err
		}
		if len(hardAsserts) == 0 {
			return res, nil
		}
		vars := buildVarChain()
		if ok, failMsg := evaluateAssertionSet(res, vars, hardAsserts); !ok {
			return res, fmt.Errorf("assertion failed: %s", failMsg)
		}
		return res, nil
	}

	intervalMs := step.PollIntervalMs
	if intervalMs <= 0 {
		intervalMs = 500
	}
	deadline := time.Now().Add(time.Duration(step.PollTimeoutMs) * time.Millisecond)

	var lastRes summary.TestResult
	var lastErr error
	for {
		res, err := ExecuteRequest(pollOpts)
		lastRes = res
		if err == nil {
			vars := buildVarChain()
			if ok, failMsg := evaluateAssertionSet(res, vars, hardAsserts); ok {
				return res, nil
			} else {
				lastErr = fmt.Errorf("poll assertions pending: %s", failMsg)
			}
		} else {
			lastErr = err
		}

		if time.Now().After(deadline) {
			break
		}
		time.Sleep(time.Duration(intervalMs) * time.Millisecond)
	}

	if lastErr == nil {
		lastErr = fmt.Errorf("poll timed out after %dms", step.PollTimeoutMs)
	}
	return lastRes, lastErr
}

func evaluateAssertionSet(res summary.TestResult, vars map[string]string, assertions []string) (bool, string) {
	for _, assertion := range assertions {
		passed, msg := variable.Assert(res.Status, []byte(res.ResponseBody), res.Duration.Milliseconds(), vars, assertion)
		if !passed {
			return false, fmt.Sprintf("%s (%s)", assertion, msg)
		}
	}
	return true, ""
}

// buildVarChain assembles the full variable map following the priority chain:
// config env vars → storage captured vars → run context (CLI + exec captures).
// Accepts an optional pre-opened store to avoid repeated DB connections in hot paths.
func buildVarChain(stores ...*storage.Store) map[string]string {
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

	// Use provided store if available, otherwise open a transient one
	var store *storage.Store
	var ownStore bool
	if len(stores) > 0 && stores[0] != nil {
		store = stores[0]
	} else {
		store, _ = storage.NewStore()
		ownStore = true
	}
	if store != nil {
		if ownStore {
			defer store.Close()
		}
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
	sort.Slice(ids, func(i, j int) bool {
		return index[ids[i]] < index[ids[j]]
	})
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
