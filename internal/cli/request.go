package cli

import (
	"encoding/json"
	"fmt"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/kest-lab/kest-cli/internal/client"
	"github.com/kest-lab/kest-cli/internal/config"
	"github.com/kest-lab/kest-cli/internal/logger"
	"github.com/kest-lab/kest-cli/internal/output"
	"github.com/kest-lab/kest-cli/internal/storage"
	"github.com/kest-lab/kest-cli/internal/variable"
	"github.com/spf13/cobra"
	"github.com/tidwall/gjson"
)

type RequestOptions struct {
	Method      string
	URL         string
	Data        string
	Headers     []string
	Queries     []string
	Captures    []string
	Asserts     []string
	Verbose     bool
	Stream      bool
	NoRecord    bool
	MaxDuration int // Max duration in milliseconds
	Retry       int // Number of retries (0 = no retry)
	RetryWait   int // Wait time between retries in milliseconds
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
)

func init() {
	methods := []string{"get", "post", "put", "delete", "patch"}
	for _, m := range methods {
		cmd := createRequestCmd(m)
		rootCmd.AddCommand(cmd)
	}
}

func createRequestCmd(method string) *cobra.Command {
	cmd := &cobra.Command{
		Use:   fmt.Sprintf("%s [url]", method),
		Short: fmt.Sprintf("Send a %s request", strings.ToUpper(method)),
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			return ExecuteRequest(RequestOptions{
				Method:      method,
				URL:         args[0],
				Data:        reqData,
				Headers:     reqHeaders,
				Queries:     reqQueries,
				Captures:    reqCaptures,
				Asserts:     reqAsserts,
				Verbose:     reqVerbose,
				Stream:      reqStream,
				NoRecord:    reqNoRec,
				MaxDuration: reqMaxDuration,
				Retry:       reqRetry,
				RetryWait:   reqRetryWait,
			})
		},
	}

	cmd.Flags().StringVarP(&reqData, "data", "d", "", "Request body data")
	cmd.Flags().StringSliceVarP(&reqHeaders, "header", "H", []string{}, "Request headers")
	cmd.Flags().StringSliceVarP(&reqQueries, "query", "q", []string{}, "Query parameters")
	cmd.Flags().StringSliceVarP(&reqCaptures, "capture", "c", []string{}, "Capture values from response (e.g. token=$.auth.token)")
	cmd.Flags().StringSliceVarP(&reqAsserts, "assert", "a", []string{}, "Assert response (e.g. status=200, body.id=1)")
	cmd.Flags().BoolVarP(&reqVerbose, "verbose", "v", false, "Show detailed request/response info")
	cmd.Flags().BoolVarP(&reqStream, "stream", "S", false, "Handle streaming response")
	cmd.Flags().BoolVar(&reqNoRec, "no-record", false, "Do not record this request")
	cmd.Flags().IntVar(&reqMaxDuration, "max-duration", 0, "Max duration in milliseconds (0 = no limit)")
	cmd.Flags().IntVar(&reqRetry, "retry", 0, "Number of retries on failure")
	cmd.Flags().IntVar(&reqRetryWait, "retry-wait", 1000, "Wait time between retries in milliseconds")

	return cmd
}

func ExecuteRequest(opts RequestOptions) error {
	method := opts.Method
	targetURL := opts.URL

	conf, _ := config.LoadConfig()
	env := conf.GetActiveEnv()
	store, _ := storage.NewStore()

	// Load variables
	var vars map[string]string
	if store != nil {
		vars, _ = store.GetVariables(conf.ProjectID, conf.ActiveEnv)
	}

	// Handle base URL
	processedURL := targetURL
	if !strings.HasPrefix(targetURL, "http") && env.BaseURL != "" {
		processedURL = strings.TrimSuffix(env.BaseURL, "/") + "/" + strings.TrimPrefix(targetURL, "/")
	}

	// Interpolate URL
	finalURL := variable.Interpolate(processedURL, vars)

	// Handle query params
	if len(opts.Queries) > 0 {
		u, err := url.Parse(finalURL)
		if err != nil {
			return err
		}
		q := u.Query()
		for _, param := range opts.Queries {
			processedParam := variable.Interpolate(param, vars)
			parts := strings.SplitN(processedParam, "=", 2)
			if len(parts) == 2 {
				q.Add(parts[0], parts[1])
			}
		}
		u.RawQuery = q.Encode()
		finalURL = u.String()
	}

	// Handle headers
	headers := make(map[string]string)
	// Default headers from config
	if conf != nil {
		for k, v := range conf.Defaults.Headers {
			headers[k] = v
		}
	}
	// Command line headers
	for _, h := range opts.Headers {
		processedHeader := variable.Interpolate(h, vars)
		parts := strings.SplitN(processedHeader, ":", 2)
		if len(parts) == 2 {
			headers[strings.TrimSpace(parts[0])] = strings.TrimSpace(parts[1])
		}
	}

	// Handle body
	var body []byte
	if opts.Data != "" {
		processedData := variable.Interpolate(opts.Data, vars)
		if strings.HasPrefix(processedData, "@") {
			content, err := os.ReadFile(processedData[1:])
			if err != nil {
				return err
			}
			body = content
		} else {
			body = []byte(processedData)
		}
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

		resp, err = client.Execute(client.RequestOptions{
			Method:  strings.ToUpper(method),
			URL:     finalURL,
			Headers: headers,
			Body:    body,
			Timeout: time.Duration(30) * time.Second,
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
			return err
		}
	}

	// Logging
	logger.LogRequest(method, finalURL, headers, string(body), resp.Status, resp.Headers, string(resp.Body), resp.Duration)

	if opts.Verbose || resp.Status >= 400 {
		fmt.Printf("\n--- Debug Info ---\n")
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
				query := strings.TrimSpace(parts[1])

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
			} else {
				fmt.Printf("  ❌ %s (%s)\n", assertion, msg)
				if firstErr == "" {
					firstErr = fmt.Sprintf("assertion failed: %s (%s)", assertion, msg)
				}
				allPassed = false
			}
		}
		if !allPassed {
			return fmt.Errorf("%s", firstErr)
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

	output.PrintResponse(strings.ToUpper(method), finalURL, resp.Status, resp.Duration.String(), resp.Body, recordID)
	return nil
}
