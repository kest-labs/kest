package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/kest-labs/kest/cli/internal/client"
	"github.com/kest-labs/kest/cli/internal/logger"
	"github.com/kest-labs/kest/cli/internal/output"
	"github.com/kest-labs/kest/cli/internal/storage"
	"github.com/kest-labs/kest/cli/internal/summary"
	"github.com/kest-labs/kest/cli/internal/variable"
	"github.com/spf13/cobra"
	"github.com/tidwall/gjson"
)

type RequestOptions struct {
	Method       string
	URL          string
	Data         string
	Headers      []string
	Queries      []string
	Captures     []string
	Asserts      []string
	SoftAsserts  []string
	Verbose      bool
	DebugVars    bool
	Stream       bool
	NoRecord     bool
	MaxDuration  int      // Max response time in milliseconds (--max-time)
	Retry        int      // Number of retries (0 = no retry)
	RetryWait    int      // Delay between retries in milliseconds (--retry-delay)
	StrictVars   bool     // Fail early when required variables are missing
	SilentOutput bool     // Suppress PrintResponse box (used by flow runner)
	Forms        []string // -F/--form fields: "fieldname=value" or "fieldname=@filepath"
}

var (
	reqData        string
	reqHeaders     []string
	reqQueries     []string
	reqCaptures    []string
	reqAsserts     []string
	reqVerbose     bool
	reqStream      bool
	reqNoRec       bool
	reqMaxDuration int
	reqRetry       int
	reqRetryWait   int
	reqVars        []string
	reqDebugVars   bool
	reqForms       []string // -F/--form fields: "fieldname=value" or "fieldname=@filepath"
)

func init() {
	methods := []string{"get", "post", "put", "delete", "patch"}
	for _, m := range methods {
		cmd := createRequestCmd(m)
		rootCmd.AddCommand(cmd)
	}
}

func createRequestCmd(method string) *cobra.Command {
	mUpper := strings.ToUpper(method)
	cmd := &cobra.Command{
		Use:   fmt.Sprintf("%s [url]", method),
		Short: fmt.Sprintf("Send a %s request", mUpper),
		Long:  fmt.Sprintf("Send an ad-hoc %s request to the specified URL. Every request is automatically recorded to the local history.", mUpper),
		Example: fmt.Sprintf(`  # Simple %[1]s request
  kest %[1]s /api/users

  # %[1]s with headers and data
  kest %[1]s /api/login -H "Content-Type: application/json" -d '{"user":"admin"}'

  # %[1]s with query parameters and assertions
  kest %[1]s /search -q "q=kest" -a "status=200" -a "body.results exists"`, method),
		Args:         cobra.ExactArgs(1),
		SilenceUsage: true,
		RunE: func(cmd *cobra.Command, args []string) error {
			// Create a temporary RunContext for ad-hoc --var flags
			if len(reqVars) > 0 {
				cliVars := make(map[string]string, len(reqVars))
				for _, v := range reqVars {
					parts := strings.SplitN(v, "=", 2)
					if len(parts) == 2 {
						cliVars[strings.TrimSpace(parts[0])] = strings.TrimSpace(parts[1])
					}
				}
				ActiveRunCtx = NewRunContext(cliVars)
				defer func() { ActiveRunCtx = nil }()
			}

			_, err := ExecuteRequest(RequestOptions{
				Method:      method,
				URL:         args[0],
				Data:        reqData,
				Headers:     reqHeaders,
				Queries:     reqQueries,
				Captures:    reqCaptures,
				Asserts:     reqAsserts,
				Verbose:     reqVerbose,
				DebugVars:   reqDebugVars,
				Stream:      reqStream,
				NoRecord:    reqNoRec,
				MaxDuration: reqMaxDuration,
				Retry:       reqRetry,
				RetryWait:   reqRetryWait,
				Forms:       reqForms,
			})
			return err
		},
	}

	cmd.Flags().StringVarP(&reqData, "data", "d", "", "Request body data")
	cmd.Flags().StringSliceVarP(&reqHeaders, "header", "H", []string{}, "Request headers")
	cmd.Flags().StringSliceVarP(&reqQueries, "query", "q", []string{}, "Query parameters")
	cmd.Flags().StringSliceVarP(&reqCaptures, "capture", "c", []string{}, "Capture values from response (e.g. token=$.auth.token)")
	cmd.Flags().StringSliceVarP(&reqAsserts, "assert", "a", []string{}, "Assert response (e.g. status=200, body.id=1)")
	cmd.Flags().BoolVarP(&reqVerbose, "verbose", "v", false, "Show detailed request/response info")
	cmd.Flags().BoolVar(&reqStream, "stream", false, "Handle streaming response")
	cmd.Flags().BoolVar(&reqNoRec, "no-record", false, "Do not record this request")
	cmd.Flags().IntVar(&reqMaxDuration, "max-time", 0, "Max response time in milliseconds (0 = no limit)")
	cmd.Flags().IntVar(&reqRetry, "retry", 0, "Number of retries on failure")
	cmd.Flags().IntVar(&reqRetryWait, "retry-delay", 1000, "Delay between retries in milliseconds")
	cmd.Flags().StringArrayVar(&reqVars, "var", []string{}, "Set variables (e.g. --var key=value)")
	cmd.Flags().BoolVar(&reqDebugVars, "debug-vars", false, "Show variable resolution details")
	cmd.Flags().StringArrayVarP(&reqForms, "form", "F", []string{}, "Multipart form field (e.g. -F file=@/path/to/file -F name=test)")

	return cmd
}

func ExecuteRequest(opts RequestOptions) (summary.TestResult, error) {
	startTime := time.Now()
	result := summary.TestResult{
		StartTime: startTime,
		Method:    strings.ToUpper(opts.Method),
		URL:       opts.URL,
	}
	method := opts.Method
	targetURL := opts.URL

	conf := loadConfigWarn()
	env := conf.GetActiveEnv()
	store, _ := storage.NewStore()
	if store != nil {
		defer store.Close()
	}

	// Load variables - merge config environment variables with runtime captured variables
	vars := make(map[string]string)

	// First, load static variables from config environment
	if env.Variables != nil {
		for k, v := range env.Variables {
			vars[k] = v
		}
	}

	// Then, load runtime captured variables (these override config variables if same name)
	if store != nil {
		capturedVars, _ := store.GetVariables(conf.ProjectID, conf.ActiveEnv)
		for k, v := range capturedVars {
			vars[k] = v
		}
	}

	// Finally, apply run context vars (CLI --var + exec captures, highest priority)
	if ActiveRunCtx != nil {
		for k, v := range ActiveRunCtx.All() {
			vars[k] = v
		}
	}

	// Debug: Show variable resolution if requested
	if opts.DebugVars && len(vars) > 0 {
		fmt.Println("\n🔍 Variable Resolution:")

		// Get captured vars for source detection
		var capturedVars map[string]string
		if store != nil {
			capturedVars, _ = store.GetVariables(conf.ProjectID, conf.ActiveEnv)
		}

		for k, v := range vars {
			source := "config"
			if ActiveRunCtx != nil {
				if _, exists := ActiveRunCtx.Get(k); exists {
					source = "cli --var"
				}
			}
			if source == "config" && capturedVars != nil {
				if _, exists := capturedVars[k]; exists {
					source = "runtime capture"
				}
			}
			// Check for built-in variables
			if k == "$randomInt" || k == "$timestamp" {
				source = "built-in"
			}

			// Truncate long values
			displayValue := v
			if len(v) > 50 {
				displayValue = v[:50] + "..."
			}
			fmt.Printf("  {{%s}} → \"%s\" (from: %s)\n", k, displayValue, source)
		}
		fmt.Println()
	}

	// Handle base URL
	processedURL := targetURL
	if !strings.HasPrefix(targetURL, "http") && env.BaseURL != "" {
		processedURL = strings.TrimSuffix(env.BaseURL, "/") + "/" + strings.TrimPrefix(targetURL, "/")
	}

	// Interpolate URL with warnings in verbose mode
	var finalURL string
	if opts.Verbose {
		var warnings []string
		finalURL, warnings = variable.InterpolateWithWarning(processedURL, vars, true)
		if len(warnings) > 0 {
			fmt.Printf("⚠️  Warning: Undefined variables in URL: %v\n", warnings)
		}
	} else {
		finalURL = variable.Interpolate(processedURL, vars)
	}
	if opts.StrictVars {
		strictURL, err := variable.InterpolateStrict(processedURL, vars)
		if err != nil {
			result.Error = err
			result.Success = false
			return result, &ExitError{Code: ExitRuntimeError, Err: err}
		}
		finalURL = strictURL
	}
	// Update result.URL to the interpolated value so logs always show the real URL
	result.URL = finalURL

	// Handle query params
	if len(opts.Queries) > 0 {
		u, err := url.Parse(finalURL)
		if err != nil {
			result.Error = err
			result.Success = false
			return result, err
		}
		q := u.Query()
		for _, param := range opts.Queries {
			processedParam := variable.Interpolate(param, vars)
			if opts.StrictVars {
				strictParam, err := variable.InterpolateStrict(param, vars)
				if err != nil {
					result.Error = err
					result.Success = false
					return result, &ExitError{Code: ExitRuntimeError, Err: err}
				}
				processedParam = strictParam
			}
			parts := strings.SplitN(processedParam, "=", 2)
			if len(parts) == 2 {
				q.Add(parts[0], parts[1])
			}
		}
		u.RawQuery = q.Encode()
		finalURL = u.String()
	}

	// Handle headers (use canonical HTTP key for dedup, preserve original case)
	headers := make(map[string]string)
	// Default headers from config
	if conf != nil {
		for k, v := range conf.Defaults.Headers {
			canonicalKey := http.CanonicalHeaderKey(strings.TrimSpace(k))
			headers[canonicalKey] = variable.Interpolate(v, vars)
		}
	}
	// Command line headers (override config headers if same key)
	for _, h := range opts.Headers {
		processedHeader := variable.Interpolate(h, vars)
		if opts.StrictVars {
			strictHeader, err := variable.InterpolateStrict(h, vars)
			if err != nil {
				result.Error = err
				result.Success = false
				return result, &ExitError{Code: ExitRuntimeError, Err: err}
			}
			processedHeader = strictHeader
		}
		parts := strings.SplitN(processedHeader, ":", 2)
		if len(parts) == 2 {
			canonicalKey := http.CanonicalHeaderKey(strings.TrimSpace(parts[0]))
			headers[canonicalKey] = strings.TrimSpace(parts[1])
		}
	}

	// Handle body
	var body []byte
	if opts.Data != "" {
		processedData := variable.Interpolate(opts.Data, vars)
		if opts.StrictVars {
			strictData, err := variable.InterpolateStrict(opts.Data, vars)
			if err != nil {
				result.Error = err
				result.Success = false
				return result, &ExitError{Code: ExitRuntimeError, Err: err}
			}
			processedData = strictData
		}
		if strings.HasPrefix(processedData, "@") {
			content, err := os.ReadFile(processedData[1:])
			if err != nil {
				result.Error = err
				result.Success = false
				return result, err
			}
			body = content
		} else {
			body = []byte(processedData)
		}
	}

	// Handle multipart form data (-F flag)
	if len(opts.Forms) > 0 {
		var buf bytes.Buffer
		writer := multipart.NewWriter(&buf)

		for _, form := range opts.Forms {
			processedForm := variable.Interpolate(form, vars)
			parts := strings.SplitN(processedForm, "=", 2)
			if len(parts) != 2 {
				continue
			}
			fieldName := strings.TrimSpace(parts[0])
			fieldValue := parts[1]

			if strings.HasPrefix(fieldValue, "@") {
				// File upload
				filePath := fieldValue[1:]
				file, err := os.Open(filePath)
				if err != nil {
					result.Error = err
					result.Success = false
					return result, err
				}
				defer file.Close()
				part, err := writer.CreateFormFile(fieldName, filepath.Base(filePath))
				if err != nil {
					result.Error = err
					result.Success = false
					return result, err
				}
				io.Copy(part, file) //nolint: errcheck
			} else {
				// Regular text field
				writer.WriteField(fieldName, fieldValue)
			}
		}
		writer.Close()

		// Set Content-Type to multipart/form-data with boundary
		headers["Content-Type"] = writer.FormDataContentType()
		body = buf.Bytes()
	}

	// Execute request with retry logic
	var resp *client.Response
	var err error
	maxRetries := opts.Retry
	if maxRetries < 0 {
		maxRetries = 0
	}

	for attempt := 0; attempt <= maxRetries; attempt++ {
		if attempt > 0 {
			fmt.Printf("⏱️  Retry attempt %d/%d (waiting %dms)...\n", attempt, maxRetries, opts.RetryWait)
			time.Sleep(time.Duration(opts.RetryWait) * time.Millisecond)
		}

		httpTimeout := 30 * time.Second
		if opts.MaxDuration > 0 {
			httpTimeout = time.Duration(opts.MaxDuration) * time.Millisecond
		}
		resp, err = client.Execute(client.RequestOptions{
			Method:  strings.ToUpper(method),
			URL:     finalURL,
			Headers: headers,
			Body:    body,
			Timeout: httpTimeout,
			Stream:  opts.Stream,
		})

		// Check duration assertion
		if err == nil && opts.MaxDuration > 0 {
			durationMs := resp.Duration.Milliseconds()
			if durationMs > int64(opts.MaxDuration) {
				err = fmt.Errorf("duration assertion failed: %dms > %dms", durationMs, opts.MaxDuration)
			}
		}

		// Break if successful or no more retries
		if err == nil {
			if attempt > 0 {
				fmt.Printf("✅ Request succeeded on retry %d\n", attempt)
			}
			break
		}

		// If last attempt, show error
		if attempt == maxRetries {
			fmt.Printf("❌ Request Failed after %d attempts: %v\n", attempt+1, err)
			result.Error = err
			result.Success = false
			return result, &ExitError{Code: ExitRuntimeError, Err: err}
		}
	}

	// Logging
	logger.LogRequest(method, finalURL, headers, string(body), resp.Status, resp.Headers, string(resp.Body), resp.Duration)

	if opts.Verbose || resp.Status >= 400 {
		fmt.Printf("\n--- Debug Info ---\n")
		fmt.Printf("Note: Headers are canonicalized per HTTP spec (e.g. X-Tenant-ID => X-Tenant-Id).\n")
		fmt.Printf("Request: %s %s\n", method, finalURL)
		fmt.Printf("Request Headers:\n")
		for k, v := range headers {
			fmt.Printf("  %s: %s\n", k, v)
		}
		if len(body) > 0 {
			fmt.Printf("Request Body: %s\n", string(body))
		}
		fmt.Printf("\nResponse Status: %d\n", resp.Status)
		fmt.Printf("Response Headers:\n")
		for k, v := range resp.Headers {
			fmt.Printf("  %s: %s\n", k, v)
		}
	}

	var recordID int64

	// Handle captures
	if store != nil && len(opts.Captures) > 0 {
		for _, capExpr := range opts.Captures {
			// Support both ":" and "="
			sep := "="
			if !strings.Contains(capExpr, "=") && strings.Contains(capExpr, ":") {
				sep = ":"
			}
			parts := strings.SplitN(capExpr, sep, 2)
			if len(parts) == 2 {
				varName := strings.TrimSpace(parts[0])
				query := NormalizeJSONPath(strings.TrimSpace(parts[1]))

				// Currently only supporting JSON body capture via gjson
				result := gjson.Get(string(resp.Body), query)
				if result.Exists() {
					store.SaveVariable(&storage.Variable{
						Name:        varName,
						Value:       result.String(),
						Environment: conf.ActiveEnv,
						Project:     conf.ProjectID,
					})
					fmt.Printf("Captured: %s = %s\n", varName, result.String())
					logger.LogToSession("Captured: %s = %s", varName, result.String())
				}
			}
		}
	}

	// Handle assertions
	if len(opts.Asserts) > 0 {
		fmt.Println("\nAssertions:")
		allPassed := true
		var firstErr string
		for _, assertion := range opts.Asserts {
			passed, msg := variable.Assert(resp.Status, resp.Body, resp.Duration.Milliseconds(), vars, assertion)
			if passed {
				fmt.Printf("  ✅ %s\n", assertion)
				logger.LogToSession("Assertion Passed: %s", assertion)
			} else {
				fmt.Printf("  ❌ Assertion Failed: %s\n", assertion)
				fmt.Printf("     %s\n", strings.ReplaceAll(msg, "\n", "\n     "))

				// Show response body snippet on failure for context
				if len(resp.Body) > 0 && len(resp.Body) < 500 {
					fmt.Printf("\n     Response Body:\n")
					fmt.Printf("     %s\n", string(resp.Body))
				} else if len(resp.Body) >= 500 {
					fmt.Printf("\n     Response Body (truncated):\n")
					fmt.Printf("     %s...\n", string(resp.Body[:500]))
				}

				logger.LogToSession("Assertion Failed: %s (%s)", assertion, msg)
				if firstErr == "" {
					firstErr = fmt.Sprintf("assertion failed: %s (%s)", assertion, msg)
				}
				allPassed = false
			}
		}

		result.Success = allPassed
		result.Status = resp.Status
		result.Duration = resp.Duration
		result.ResponseBody = string(resp.Body)

		if !allPassed {
			result.Error = fmt.Errorf("%s", firstErr)
			return result, &ExitError{Code: ExitAssertionFailed, Err: result.Error}
		}
	}

	if len(opts.SoftAsserts) > 0 {
		fmt.Println("\nSoft Assertions:")
		for _, assertion := range opts.SoftAsserts {
			passed, msg := variable.Assert(resp.Status, resp.Body, resp.Duration.Milliseconds(), vars, assertion)
			if passed {
				fmt.Printf("  ✅ %s\n", assertion)
				continue
			}
			fmt.Printf("  ⚠️  Soft assertion failed: %s\n", assertion)
			fmt.Printf("     %s\n", strings.ReplaceAll(msg, "\n", "\n     "))
			logger.LogToSession("Soft Assertion Failed: %s (%s)", assertion, msg)
		}
	}

	if !opts.NoRecord && store != nil {
		headerJSON, _ := json.Marshal(headers)
		respHeaderJSON, _ := json.Marshal(resp.Headers)

		u, _ := url.Parse(finalURL)
		queryJSON, _ := json.Marshal(u.Query())

		recordID, _ = store.SaveRecord(&storage.Record{
			Method:          strings.ToUpper(method),
			URL:             finalURL,
			BaseURL:         env.BaseURL,
			Path:            u.Path,
			QueryParams:     queryJSON,
			RequestHeaders:  headerJSON,
			RequestBody:     string(body),
			ResponseStatus:  resp.Status,
			ResponseHeaders: respHeaderJSON,
			ResponseBody:    string(resp.Body),
			DurationMs:      resp.Duration.Milliseconds(),
			Environment:     conf.ActiveEnv,
			Project:         conf.ProjectID,
		})
	}

	result.Status = resp.Status
	result.Duration = resp.Duration
	result.ResponseBody = string(resp.Body)
	result.Success = true

	if !opts.SilentOutput {
		output.PrintResponse(strings.ToUpper(method), finalURL, resp.Status, resp.Duration.String(), resp.Body, recordID, startTime)
	}
	return result, nil
}
