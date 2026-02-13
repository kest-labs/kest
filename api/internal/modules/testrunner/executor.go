package testrunner

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/jmespath/go-jmespath"
	kest_http "github.com/kest-labs/kest/api/internal/infra/http"
	"github.com/kest-labs/kest/api/internal/modules/testcase"
)

// Executor handles the execution of a test case
type Executor struct {
	client *kest_http.Client
}

// NewExecutor creates a new test case executor
func NewExecutor() *Executor {
	return &Executor{
		client: kest_http.New(),
	}
}

// Execute runs a single test case
func (e *Executor) Execute(ctx context.Context, tc *testcase.TestCaseResponse, envVars map[string]any) (*testcase.RunTestCaseResponse, error) {
	start := time.Now()

	// 1. Prepare Request
	method := tc.Method
	if method == "" {
		method = "GET"
	}

	// Build URL with variable replacement
	url := tc.Path
	url = e.replaceVariables(url, envVars)

	// If URL is relative, try to prepend base_url from envVars
	if !strings.HasPrefix(url, "http") {
		if baseURL, ok := envVars["base_url"].(string); ok && baseURL != "" {
			url = strings.TrimRight(baseURL, "/") + "/" + strings.TrimLeft(url, "/")
		}
	}

	// Build Headers
	headers := make(map[string]string)
	for k, v := range tc.Headers {
		headers[k] = e.replaceVariables(v, envVars)
	}

	// Build Body
	var body any
	if tc.RequestBody != nil {
		bodyJSON, _ := json.Marshal(tc.RequestBody)
		bodyStr := e.replaceVariables(string(bodyJSON), envVars)
		json.Unmarshal([]byte(bodyStr), &body)
	}

	// 2. Perform Request
	client := kest_http.New().
		Timeout(10 * time.Second).
		WithHeaders(headers)

	var resp *kest_http.Response
	var err error

	switch strings.ToUpper(method) {
	case "GET":
		resp, err = client.GetContext(ctx, url)
	case "POST":
		resp, err = client.PostContext(ctx, url, body)
	case "PUT":
		resp, err = client.PutContext(ctx, url, body)
	case "PATCH":
		resp, err = client.PatchContext(ctx, url, body)
	case "DELETE":
		resp, err = client.DeleteContext(ctx, url)
	default:
		err = fmt.Errorf("unsupported method: %s", method)
	}

	duration := time.Since(start).Milliseconds()

	result := &testcase.RunTestCaseResponse{
		TestCaseID: tc.ID,
		DurationMs: duration,
		Request: &testcase.RunRequestInfo{
			Method:  method,
			URL:     url,
			Headers: headers,
			Body:    body,
		},
		Variables: make(map[string]any),
	}

	if err != nil {
		result.Status = "error"
		result.Message = err.Error()
		return result, nil
	}

	// 3. Populate Response Info
	respHeaders := make(map[string]string)
	for k, v := range resp.Header {
		if len(v) > 0 {
			respHeaders[k] = v[0]
		}
	}

	var respBody any
	if len(resp.Body()) > 0 {
		json.Unmarshal(resp.Body(), &respBody)
	}

	result.Response = &testcase.RunResponseInfo{
		Status:  resp.StatusCode,
		Headers: respHeaders,
		Body:    respBody,
	}

	// 4. Apply Assertions
	passed := true
	for _, assertion := range tc.Assertions {
		res := e.applyAssertion(assertion, result.Response)
		result.Assertions = append(result.Assertions, res)
		if !res.Passed {
			passed = false
		}
	}

	if passed {
		result.Status = "pass"
	} else {
		result.Status = "fail"
	}

	// 5. Extract Variables
	for _, ext := range tc.ExtractVars {
		val := e.extractVariable(ext, result.Response)
		if val != nil {
			result.Variables[ext.Name] = val
		}
	}

	return result, nil
}

func (e *Executor) replaceVariables(input string, vars map[string]any) string {
	for k, v := range vars {
		placeholder := fmt.Sprintf("{{%s}}", k)
		valStr := fmt.Sprintf("%v", v)
		input = strings.ReplaceAll(input, placeholder, valStr)
	}
	return input
}

func (e *Executor) applyAssertion(a testcase.Assertion, resp *testcase.RunResponseInfo) *testcase.AssertionResult {
	res := &testcase.AssertionResult{
		Type:     a.Type,
		Operator: a.Operator,
		Path:     a.Path,
		Expect:   a.Expect,
		Message:  a.Message,
	}

	var actual any
	switch a.Type {
	case "status":
		actual = float64(resp.Status) // JSON numbers are often float64
	case "json_path":
		if resp.Body != nil {
			actual, _ = jmespath.Search(a.Path, resp.Body)
		}
	case "header":
		actual = resp.Headers[a.Path]
	}

	res.Actual = actual

	// Simple comparison logic
	switch a.Operator {
	case "equals":
		res.Passed = fmt.Sprintf("%v", actual) == fmt.Sprintf("%v", a.Expect)
	case "not_equals":
		res.Passed = fmt.Sprintf("%v", actual) != fmt.Sprintf("%v", a.Expect)
	case "exists":
		res.Passed = actual != nil
	case "contains":
		res.Passed = strings.Contains(fmt.Sprintf("%v", actual), fmt.Sprintf("%v", a.Expect))
	default:
		res.Passed = false
		res.Message = "Unsupported operator: " + a.Operator
	}

	if !res.Passed && res.Message == "" {
		res.Message = fmt.Sprintf("Expected %v, but got %v", a.Expect, actual)
	}

	return res
}

func (e *Executor) extractVariable(ext testcase.ExtractVar, resp *testcase.RunResponseInfo) any {
	switch ext.Source {
	case "body":
		if resp.Body != nil {
			val, _ := jmespath.Search(ext.Path, resp.Body)
			return val
		}
	case "header":
		return resp.Headers[ext.Path]
	}
	return nil
}
