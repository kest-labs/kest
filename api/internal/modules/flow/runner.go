package flow

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"
)

// StepEvent represents a real-time event during flow execution
type StepEvent struct {
	RunID    uint   `json:"run_id"`
	StepID   uint   `json:"step_id"`
	StepName string `json:"step_name"`
	Status   string `json:"status"`
	Data     any    `json:"data,omitempty"`
}

// AssertResult represents a single assertion result
type AssertResult struct {
	Expression string `json:"expression"`
	Passed     bool   `json:"passed"`
	Expected   string `json:"expected,omitempty"`
	Actual     string `json:"actual,omitempty"`
}

// Runner executes a flow's steps sequentially
type Runner struct {
	repo    Repository
	baseURL string
}

// NewRunner creates a new flow runner
func NewRunner(repo Repository, baseURL string) *Runner {
	return &Runner{repo: repo, baseURL: baseURL}
}

// Execute runs all steps of a flow and sends events to the channel
func (r *Runner) Execute(ctx context.Context, run *FlowRunPO, steps []FlowStepPO, edges []FlowEdgePO, events chan<- StepEvent) error {
	defer close(events)

	// Mark run as running
	now := time.Now()
	run.Status = RunStatusRunning
	run.StartedAt = &now
	if err := r.repo.UpdateRun(ctx, run); err != nil {
		return err
	}

	// Get step results
	results, err := r.repo.ListStepResultsByRun(ctx, run.ID)
	if err != nil {
		return err
	}
	resultMap := make(map[uint]*FlowStepResultPO)
	for _, result := range results {
		resultMap[result.StepID] = result
	}

	// Build execution order from edges (topological sort)
	orderedSteps := r.topologicalSort(steps, edges)

	// Variable store for captures
	variables := make(map[string]any)
	capturedByStep := make(map[uint]map[string]any)
	allPassed := true

	for _, step := range orderedSteps {
		select {
		case <-ctx.Done():
			run.Status = RunStatusCanceled
			finished := time.Now()
			run.FinishedAt = &finished
			_ = r.repo.UpdateRun(ctx, run)
			return ctx.Err()
		default:
		}

		// Send running event
		events <- StepEvent{
			RunID:    run.ID,
			StepID:   step.ID,
			StepName: step.Name,
			Status:   RunStatusRunning,
		}

		executionVariables := make(map[string]any, len(variables))
		for key, value := range variables {
			executionVariables[key] = value
		}
		var mappingErr error
		for _, edge := range edges {
			if edge.TargetStepID != step.ID {
				continue
			}

			rules, err := parseVariableMappingRules(edge.VariableMapping)
			if err != nil {
				mappingErr = err
				break
			}

			upstream := capturedByStep[edge.SourceStepID]
			for _, rule := range rules {
				if upstream == nil {
					continue
				}
				if value, ok := upstream[rule.Source]; ok {
					executionVariables[rule.Target] = value
				}
			}
		}
		if mappingErr != nil {
			stepResult := &FlowStepResultPO{
				StepID:       step.ID,
				Status:       RunStatusFailed,
				ErrorMessage: mappingErr.Error(),
			}
			if result, ok := resultMap[step.ID]; ok {
				result.Status = stepResult.Status
				result.ErrorMessage = stepResult.ErrorMessage
				_ = r.repo.UpdateStepResult(ctx, result)
			}
			events <- StepEvent{
				RunID:    run.ID,
				StepID:   step.ID,
				StepName: step.Name,
				Status:   stepResult.Status,
				Data:     stepResult,
			}
			allPassed = false
			break
		}

		// Execute step
		stepResult := r.executeStep(ctx, &step, executionVariables)
		if captured := parseCapturedVariables(stepResult.VariablesCaptured); len(captured) > 0 {
			for key, value := range captured {
				variables[key] = value
			}
			capturedByStep[step.ID] = captured
		}

		// Update result in DB
		if result, ok := resultMap[step.ID]; ok {
			result.Status = stepResult.Status
			result.Request = stepResult.Request
			result.Response = stepResult.Response
			result.AssertResults = stepResult.AssertResults
			result.DurationMs = stepResult.DurationMs
			result.VariablesCaptured = stepResult.VariablesCaptured
			result.ErrorMessage = stepResult.ErrorMessage
			_ = r.repo.UpdateStepResult(ctx, result)
		}

		// Send completed event
		events <- StepEvent{
			RunID:    run.ID,
			StepID:   step.ID,
			StepName: step.Name,
			Status:   stepResult.Status,
			Data:     stepResult,
		}

		if stepResult.Status == RunStatusFailed {
			allPassed = false
			break
		}
	}

	// Mark run as finished
	finished := time.Now()
	run.FinishedAt = &finished
	if allPassed {
		run.Status = RunStatusPassed
	} else {
		run.Status = RunStatusFailed
	}
	return r.repo.UpdateRun(ctx, run)
}

// executeStep runs a single HTTP request step
func (r *Runner) executeStep(ctx context.Context, step *FlowStepPO, variables map[string]any) *FlowStepResultPO {
	result := &FlowStepResultPO{
		StepID: step.ID,
		Status: RunStatusPending,
	}

	// Resolve variables in URL, headers, body
	url := r.resolveVariables(step.URL, variables)
	if !strings.HasPrefix(url, "http") {
		url = r.baseURL + url
	}
	body := r.resolveVariables(step.Body, variables)
	headersStr := r.resolveVariables(step.Headers, variables)
	unresolved := collectUnresolvedVariables(url, headersStr, body)
	if len(unresolved) > 0 {
		result.Status = RunStatusFailed
		result.ErrorMessage = fmt.Sprintf("unresolved variables: %s", strings.Join(unresolved, ", "))
		return result
	}

	// Build request info for logging
	reqInfo := map[string]any{
		"method":  step.Method,
		"url":     url,
		"headers": headersStr,
		"body":    body,
	}
	reqJSON, _ := json.Marshal(reqInfo)
	result.Request = string(reqJSON)

	// Create HTTP request
	var bodyReader io.Reader
	if body != "" {
		bodyReader = bytes.NewBufferString(body)
	}

	req, err := http.NewRequestWithContext(ctx, step.Method, url, bodyReader)
	if err != nil {
		result.Status = RunStatusFailed
		result.ErrorMessage = fmt.Sprintf("failed to create request: %v", err)
		return result
	}

	// Parse and set headers
	if headersStr != "" {
		var headers map[string]string
		if err := json.Unmarshal([]byte(headersStr), &headers); err == nil {
			for k, v := range headers {
				req.Header.Set(k, r.resolveVariables(v, variables))
			}
		}
	}

	// Ensure Content-Type is set for requests with body
	if body != "" && req.Header.Get("Content-Type") == "" {
		req.Header.Set("Content-Type", "application/json")
	}

	// Execute request
	client := &http.Client{Timeout: 30 * time.Second}
	start := time.Now()
	resp, err := client.Do(req)
	duration := time.Since(start)
	result.DurationMs = duration.Milliseconds()

	if err != nil {
		result.Status = RunStatusFailed
		result.ErrorMessage = fmt.Sprintf("request failed: %v", err)
		return result
	}
	defer resp.Body.Close()

	// Read response body
	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		result.Status = RunStatusFailed
		result.ErrorMessage = fmt.Sprintf("failed to read response: %v", err)
		return result
	}

	// Store response info
	respInfo := map[string]any{
		"status":  resp.StatusCode,
		"headers": resp.Header,
		"body":    string(respBody),
	}
	respJSON, _ := json.Marshal(respInfo)
	result.Response = string(respJSON)

	// Parse response body as JSON
	var respData map[string]any
	_ = json.Unmarshal(respBody, &respData)

	// Process captures
	captured := r.processCaptures(step.Captures, resp.StatusCode, respData, variables)
	if len(captured) > 0 {
		capturedJSON, _ := json.Marshal(captured)
		result.VariablesCaptured = string(capturedJSON)
	}

	// Process assertions
	assertResults := r.processAsserts(step.Asserts, resp.StatusCode, respData, duration)
	assertJSON, _ := json.Marshal(assertResults)
	result.AssertResults = string(assertJSON)

	// Determine pass/fail
	allPassed := true
	for _, ar := range assertResults {
		if !ar.Passed {
			allPassed = false
			break
		}
	}

	if allPassed {
		result.Status = RunStatusPassed
	} else {
		result.Status = RunStatusFailed
		// Build error message from failed assertions
		var failedMsgs []string
		for _, ar := range assertResults {
			if !ar.Passed {
				failedMsgs = append(failedMsgs, fmt.Sprintf("%s (expected: %s, actual: %s)", ar.Expression, ar.Expected, ar.Actual))
			}
		}
		result.ErrorMessage = strings.Join(failedMsgs, "; ")
	}

	return result
}

// resolveVariables replaces {{variable}} placeholders with actual values
func (r *Runner) resolveVariables(input string, variables map[string]any) string {
	if input == "" {
		return input
	}
	re := regexp.MustCompile(`\{\{(\w+)\}\}`)
	return re.ReplaceAllStringFunc(input, func(match string) string {
		key := match[2 : len(match)-2]
		if val, ok := variables[key]; ok {
			switch v := val.(type) {
			case string:
				return v
			case float64:
				if v == float64(int64(v)) {
					return strconv.FormatInt(int64(v), 10)
				}
				return strconv.FormatFloat(v, 'f', -1, 64)
			default:
				return fmt.Sprintf("%v", v)
			}
		}
		return match
	})
}

func collectUnresolvedVariables(values ...string) []string {
	re := regexp.MustCompile(`\{\{(\w+)\}\}`)
	seen := make(map[string]struct{})

	for _, value := range values {
		matches := re.FindAllStringSubmatch(value, -1)
		for _, match := range matches {
			if len(match) < 2 {
				continue
			}
			seen[match[1]] = struct{}{}
		}
	}

	keys := make([]string, 0, len(seen))
	for key := range seen {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	return keys
}

func parseCapturedVariables(raw string) map[string]any {
	if strings.TrimSpace(raw) == "" {
		return nil
	}

	var captured map[string]any
	if err := json.Unmarshal([]byte(raw), &captured); err != nil {
		return nil
	}

	return captured
}

// processCaptures extracts variables from the response
// Format: "variable_name: json.path" (one per line)
func (r *Runner) processCaptures(capturesStr string, statusCode int, respData map[string]any, variables map[string]any) map[string]any {
	captured := make(map[string]any)
	if capturesStr == "" {
		return captured
	}

	lines := strings.Split(capturesStr, "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}

		separatorIndex := strings.Index(line, ":")
		if equalsIndex := strings.Index(line, "="); equalsIndex != -1 && (separatorIndex == -1 || equalsIndex < separatorIndex) {
			separatorIndex = equalsIndex
		}
		if separatorIndex == -1 {
			continue
		}

		varName := strings.TrimSpace(line[:separatorIndex])
		jsonPath := strings.TrimSpace(line[separatorIndex+1:])
		if varName == "" || jsonPath == "" {
			continue
		}

		// Extract value from response
		val := r.extractJSONPath(respData, jsonPath)
		if val != nil {
			variables[varName] = val
			captured[varName] = val
		}
	}

	return captured
}

// extractJSONPath extracts a value from a JSON object using dot notation
// e.g., "data.access_token" from {"data": {"access_token": "..."}}
func (r *Runner) extractJSONPath(data map[string]any, path string) any {
	if data == nil {
		return nil
	}

	normalizedPath := strings.TrimSpace(path)
	normalizedPath = strings.TrimPrefix(normalizedPath, "body.")
	normalizedPath = regexp.MustCompile(`\[(\d+)\]`).ReplaceAllString(normalizedPath, ".$1")
	normalizedPath = strings.TrimPrefix(normalizedPath, ".")
	if normalizedPath == "" {
		return data
	}

	parts := strings.Split(normalizedPath, ".")
	var current any = data

	for _, part := range parts {
		if part == "" {
			continue
		}
		switch v := current.(type) {
		case map[string]any:
			current = v[part]
		case []any:
			index, err := strconv.Atoi(part)
			if err != nil || index < 0 || index >= len(v) {
				return nil
			}
			current = v[index]
		default:
			return nil
		}
	}

	return current
}

// processAsserts evaluates assertion expressions
// Format: "status == 200", "body.code == 0", "body.data.id exists", "duration < 1000ms"
func (r *Runner) processAsserts(assertsStr string, statusCode int, respData map[string]any, duration time.Duration) []AssertResult {
	var results []AssertResult
	if assertsStr == "" {
		return results
	}

	lines := strings.Split(assertsStr, "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}

		result := r.evaluateAssert(line, statusCode, respData, duration)
		results = append(results, result)
	}

	return results
}

func (r *Runner) evaluateAssert(expr string, statusCode int, respData map[string]any, duration time.Duration) AssertResult {
	result := AssertResult{Expression: expr}

	// Handle "exists" assertions
	if strings.HasSuffix(expr, " exists") {
		path := strings.TrimSuffix(expr, " exists")
		path = strings.TrimPrefix(path, "body.")
		val := r.extractJSONPath(respData, path)
		result.Passed = val != nil
		result.Expected = "exists"
		if val != nil {
			result.Actual = fmt.Sprintf("%v", val)
		} else {
			result.Actual = "nil"
		}
		return result
	}

	// Handle duration assertions: "duration < 1000ms"
	if strings.HasPrefix(expr, "duration") {
		return r.evaluateDurationAssert(expr, duration)
	}

	// Handle comparison assertions: "field == value"
	parts := strings.SplitN(expr, " == ", 2)
	if len(parts) == 2 {
		field := strings.TrimSpace(parts[0])
		expected := strings.TrimSpace(parts[1])
		expected = strings.Trim(expected, "\"")

		var actual any
		if field == "status" {
			actual = statusCode
		} else if strings.HasPrefix(field, "body.") {
			path := strings.TrimPrefix(field, "body.")
			actual = r.extractJSONPath(respData, path)
		}

		result.Expected = expected
		result.Actual = fmt.Sprintf("%v", actual)

		// Compare
		expectedNum, errE := strconv.ParseFloat(expected, 64)
		if errE == nil {
			switch v := actual.(type) {
			case float64:
				result.Passed = v == expectedNum
			case int:
				result.Passed = float64(v) == expectedNum
			default:
				result.Passed = fmt.Sprintf("%v", actual) == expected
			}
		} else {
			result.Passed = fmt.Sprintf("%v", actual) == expected
		}

		return result
	}

	// Unknown assertion format
	result.Passed = false
	result.Expected = "valid assertion"
	result.Actual = "unknown format"
	return result
}

func (r *Runner) evaluateDurationAssert(expr string, duration time.Duration) AssertResult {
	result := AssertResult{Expression: expr}
	durationMs := duration.Milliseconds()
	result.Actual = fmt.Sprintf("%dms", durationMs)

	// Parse "duration < 1000ms"
	re := regexp.MustCompile(`duration\s*(<|>|<=|>=|==)\s*(\d+)ms`)
	matches := re.FindStringSubmatch(expr)
	if len(matches) != 3 {
		result.Passed = false
		result.Expected = "valid duration expression"
		return result
	}

	op := matches[1]
	threshold, _ := strconv.ParseInt(matches[2], 10, 64)
	result.Expected = fmt.Sprintf("%s %dms", op, threshold)

	switch op {
	case "<":
		result.Passed = durationMs < threshold
	case ">":
		result.Passed = durationMs > threshold
	case "<=":
		result.Passed = durationMs <= threshold
	case ">=":
		result.Passed = durationMs >= threshold
	case "==":
		result.Passed = durationMs == threshold
	}

	return result
}

// topologicalSort orders steps based on edges (dependencies)
// Falls back to sort_order if no edges
func (r *Runner) topologicalSort(steps []FlowStepPO, edges []FlowEdgePO) []FlowStepPO {
	if len(edges) == 0 {
		// No edges, use sort_order
		sort.SliceStable(steps, func(i, j int) bool {
			if steps[i].SortOrder == steps[j].SortOrder {
				return steps[i].ID < steps[j].ID
			}
			return steps[i].SortOrder < steps[j].SortOrder
		})
		return steps
	}

	// Build adjacency list and in-degree map
	adj := make(map[uint][]uint)
	inDegree := make(map[uint]int)
	stepMap := make(map[uint]FlowStepPO)

	for _, step := range steps {
		inDegree[step.ID] = 0
		stepMap[step.ID] = step
	}

	for _, edge := range edges {
		adj[edge.SourceStepID] = append(adj[edge.SourceStepID], edge.TargetStepID)
		inDegree[edge.TargetStepID]++
	}

	// BFS
	var queue []uint
	zeroInDegree := make([]FlowStepPO, 0)
	for _, step := range steps {
		if inDegree[step.ID] == 0 {
			zeroInDegree = append(zeroInDegree, step)
		}
	}
	sort.SliceStable(zeroInDegree, func(i, j int) bool {
		if zeroInDegree[i].SortOrder == zeroInDegree[j].SortOrder {
			return zeroInDegree[i].ID < zeroInDegree[j].ID
		}
		return zeroInDegree[i].SortOrder < zeroInDegree[j].SortOrder
	})
	for _, step := range zeroInDegree {
		queue = append(queue, step.ID)
	}

	var ordered []FlowStepPO
	for len(queue) > 0 {
		current := queue[0]
		queue = queue[1:]

		if step, ok := stepMap[current]; ok {
			ordered = append(ordered, step)
		}

		nextSteps := adj[current]
		sort.SliceStable(nextSteps, func(i, j int) bool {
			left := stepMap[nextSteps[i]]
			right := stepMap[nextSteps[j]]
			if left.SortOrder == right.SortOrder {
				return left.ID < right.ID
			}
			return left.SortOrder < right.SortOrder
		})
		for _, next := range nextSteps {
			inDegree[next]--
			if inDegree[next] == 0 {
				queue = append(queue, next)
			}
		}
	}

	// If some steps weren't reached (disconnected), append them
	if len(ordered) < len(steps) {
		reachedSet := make(map[uint]bool)
		for _, s := range ordered {
			reachedSet[s.ID] = true
		}
		sort.SliceStable(steps, func(i, j int) bool {
			if steps[i].SortOrder == steps[j].SortOrder {
				return steps[i].ID < steps[j].ID
			}
			return steps[i].SortOrder < steps[j].SortOrder
		})
		for _, s := range steps {
			if !reachedSet[s.ID] {
				ordered = append(ordered, s)
			}
		}
	}

	return ordered
}
