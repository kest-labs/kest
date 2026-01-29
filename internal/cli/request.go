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
	"github.com/kest-lab/kest-cli/internal/output"
	"github.com/kest-lab/kest-cli/internal/storage"
	"github.com/kest-lab/kest-cli/internal/variable"
	"github.com/spf13/cobra"
	"github.com/tidwall/gjson"
)

var (
	reqData     string
	reqHeaders  []string
	reqQueries  []string
	reqCaptures []string
	reqAsserts  []string
	reqNoRec    bool
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
			return runRequest(method, args[0])
		},
	}

	cmd.Flags().StringVarP(&reqData, "data", "d", "", "Request body data")
	cmd.Flags().StringSliceVarP(&reqHeaders, "header", "H", []string{}, "Request headers")
	cmd.Flags().StringSliceVarP(&reqQueries, "query", "q", []string{}, "Query parameters")
	cmd.Flags().StringSliceVarP(&reqCaptures, "capture", "c", []string{}, "Capture values from response (e.g. token=$.auth.token)")
	cmd.Flags().StringSliceVarP(&reqAsserts, "assert", "a", []string{}, "Assert response (e.g. status=200, body.id=1)")
	cmd.Flags().BoolVar(&reqNoRec, "no-record", false, "Do not record this request")

	return cmd
}

func runRequest(method, targetURL string) error {
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
	if len(reqQueries) > 0 {
		u, err := url.Parse(finalURL)
		if err != nil {
			return err
		}
		q := u.Query()
		for _, param := range reqQueries {
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
	for _, h := range reqHeaders {
		processedHeader := variable.Interpolate(h, vars)
		parts := strings.SplitN(processedHeader, ":", 2)
		if len(parts) == 2 {
			headers[strings.TrimSpace(parts[0])] = strings.TrimSpace(parts[1])
		}
	}

	// Handle body
	var body []byte
	if reqData != "" {
		processedData := variable.Interpolate(reqData, vars)
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

	resp, err := client.Execute(client.RequestOptions{
		Method:  strings.ToUpper(method),
		URL:     finalURL,
		Headers: headers,
		Body:    body,
		Timeout: time.Duration(30) * time.Second,
	})
	if err != nil {
		return err
	}

	var recordID int64

	// Handle captures
	if store != nil && len(reqCaptures) > 0 {
		for _, capExpr := range reqCaptures {
			parts := strings.SplitN(capExpr, "=", 2)
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
	if len(reqAsserts) > 0 {
		fmt.Println("\nAssertions:")
		allPassed := true
		for _, assertion := range reqAsserts {
			passed, msg := variable.Assert(resp.Status, resp.Body, assertion)
			if passed {
				fmt.Printf("  ✅ %s\n", assertion)
			} else {
				fmt.Printf("  ❌ %s (%s)\n", assertion, msg)
				allPassed = false
			}
		}
		if !allPassed {
			// We don't necessarily return error here, just print results
		}
	}

	if !reqNoRec && store != nil {
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
