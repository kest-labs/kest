package main

import (
	"crypto/sha1"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/kest-labs/kest/cli/internal/config"
	"github.com/kest-labs/kest/cli/internal/platformsync"
	"github.com/kest-labs/kest/cli/internal/storage"
	"github.com/kest-labs/kest/cli/internal/summary"
)

func validateFlowSyncConfig(conf *config.Config) (string, error) {
	if conf == nil {
		return "", fmt.Errorf("platform config is required")
	}
	if strings.TrimSpace(conf.PlatformURL) == "" {
		return "", fmt.Errorf("platform URL is required for --sync")
	}
	if strings.TrimSpace(conf.PlatformToken) == "" {
		return "", fmt.Errorf("platform token is required for --sync")
	}
	workspaceID := strings.TrimSpace(conf.PlatformProjectID)
	if workspaceID == "" {
		return "", fmt.Errorf("platform workspace ID is required for --sync; set KEST_PLATFORM_WORKSPACE_ID or platform_project_id")
	}
	return workspaceID, nil
}

func syncFlowDefinitions(conf *config.Config, workspaceID string, results []runExecutionResult, profileName string, root string) error {
	flows := make([]platformsync.FlowDefinitionSync, 0, len(results))
	for _, result := range results {
		if result.FlowDoc == nil || result.SourceID != "" {
			continue
		}
		flow, err := buildFlowDefinitionSync(result, root)
		if err != nil {
			return err
		}
		flows = append(flows, flow)
	}
	if len(flows) == 0 {
		return nil
	}

	metadata, _ := json.Marshal(map[string]interface{}{
		"cli_version": Version,
		"profile":     profileName,
		"sync_time":   time.Now().UTC().Format(time.RFC3339),
	})
	resp, err := platformsync.PushFlowDefinitions(conf, workspaceID, platformsync.FlowDefinitionSyncRequest{
		Source:   platformsync.FlowSyncSource,
		Metadata: metadata,
		Flows:    flows,
	})
	if err != nil {
		return err
	}
	printFlowSyncSummary("Flow definition sync", resp)
	return nil
}

func syncFlowRuns(conf *config.Config, workspaceID string, results []runExecutionResult, profileName string, envName string, baseURL string, root string, runnerType string) error {
	store, err := storage.NewStore()
	if err != nil {
		return fmt.Errorf("failed to open storage for flow sync: %w", err)
	}
	defer store.Close()

	clientID, err := store.GetOrCreateClientID()
	if err != nil {
		return fmt.Errorf("failed to load sync client id: %w", err)
	}

	for _, result := range results {
		if result.FlowDoc == nil || result.Summary == nil {
			continue
		}
		req := buildFlowRunSyncRequest(result, profileName, envName, baseURL, root, clientID, runnerType)
		resp, err := platformsync.PushFlowRun(conf, workspaceID, req)
		if err != nil {
			return err
		}
		printFlowSyncSummary(fmt.Sprintf("Flow run sync (%s)", filepath.Base(result.SourcePath)), resp)
	}
	return nil
}

func buildFlowDefinitionSync(result runExecutionResult, root string) (platformsync.FlowDefinitionSync, error) {
	doc := result.FlowDoc
	sourcePath := displaySourcePath(result.SourcePath, root)
	if result.SourceID != "" {
		sourcePath = result.SourcePath
	} else if result.SourcePath != "" && !filepath.IsAbs(result.SourcePath) {
		sourcePath = result.SourcePath
	}
	sourceHash, err := fileSHA1(result.SourcePath)
	if err != nil {
		return platformsync.FlowDefinitionSync{}, err
	}

	sourceID := strings.TrimSpace(result.SourceID)
	if sourceID == "" {
		sourceID = strings.TrimSpace(doc.Meta.ID)
	}
	if sourceID == "" {
		sourceID = "path:" + sourcePath
	}
	name := strings.TrimSpace(doc.Meta.Name)
	if name == "" {
		name = strings.TrimSuffix(filepath.Base(result.SourcePath), ".flow.md")
	}

	steps := make([]platformsync.FlowStepSync, 0, len(doc.Setup)+len(doc.Steps)+len(doc.Teardown))
	appendSteps := func(items []FlowStep, phase string) {
		for _, step := range items {
			order := len(steps)
			stepSync := buildFlowStepSync(step, phase, order)
			steps = append(steps, stepSync)
		}
	}
	appendSteps(doc.Setup, "setup")
	appendSteps(doc.Steps, "step")
	appendSteps(doc.Teardown, "teardown")

	edges := make([]platformsync.FlowEdgeSync, 0, len(doc.Edges))
	for _, edge := range doc.Edges {
		edges = append(edges, platformsync.FlowEdgeSync{
			SourceStepID: edge.From,
			TargetStepID: edge.To,
			Condition:    edge.On,
		})
	}

	return platformsync.FlowDefinitionSync{
		SourceID:    sourceID,
		SourcePath:  sourcePath,
		SourceHash:  sourceHash,
		Name:        name,
		Version:     doc.Meta.Version,
		Environment: doc.Meta.Env,
		Tags:        doc.Meta.Tags,
		ReadOnly:    true,
		Steps:       steps,
		Edges:       edges,
	}, nil
}

func buildFlowStepSync(step FlowStep, phase string, sortOrder int) platformsync.FlowStepSync {
	stepType := strings.TrimSpace(step.Type)
	if stepType == "" {
		stepType = "http"
	}

	method := strings.ToUpper(strings.TrimSpace(step.Request.Method))
	url := strings.TrimSpace(step.Request.URL)
	body := step.Request.Data
	headers := marshalStringList(step.Request.Headers)
	captures := marshalStringList(step.Request.Captures)
	asserts := marshalStringList(append(step.Request.Asserts, step.Request.SoftAsserts...))
	if stepType == "exec" {
		method = "EXEC"
		url = step.Exec.Command
		body = step.Exec.Command
		captures = marshalStringList(step.Exec.Captures)
	}
	if method == "" {
		method = "STEP"
	}
	if url == "" {
		url = stepName(step)
	}

	return platformsync.FlowStepSync{
		SourceID:  step.ID,
		Name:      stepName(step),
		SortOrder: sortOrder,
		Type:      stepType,
		Method:    method,
		URL:       url,
		Headers:   headers,
		Body:      body,
		Captures:  captures,
		Asserts:   asserts,
		PositionX: float64(120 + (sortOrder%4)*260),
		PositionY: float64(80 + (sortOrder/4)*180),
	}
}

func buildFlowRunSyncRequest(result runExecutionResult, profileName string, envName string, baseURL string, root string, clientID string, runnerType string) platformsync.FlowRunSyncRequest {
	sourcePath := displaySourcePath(result.SourcePath, root)
	if result.SourceID != "" {
		sourcePath = result.SourcePath
	} else if result.SourcePath != "" && !filepath.IsAbs(result.SourcePath) {
		sourcePath = result.SourcePath
	}
	sourceFlowID := strings.TrimSpace(result.SourceID)
	if result.FlowDoc != nil {
		if sourceFlowID == "" {
			sourceFlowID = strings.TrimSpace(result.FlowDoc.Meta.ID)
		}
	}
	if sourceFlowID == "" {
		sourceFlowID = "path:" + sourcePath
	}

	startedAt := result.StartedAt
	if result.Summary != nil && !result.Summary.StartTime.IsZero() {
		startedAt = result.Summary.StartTime
	}
	if startedAt.IsZero() {
		startedAt = time.Now().UTC()
	}
	finishedAt := result.FinishedAt
	if finishedAt.IsZero() {
		finishedAt = startedAt.Add(summaryDuration(result.Summary))
	}

	sourceEventID := fmt.Sprintf("%s:flow-run:%s", clientID, shortSHA1(strings.Join([]string{
		sourcePath,
		profileName,
		startedAt.UTC().Format(time.RFC3339Nano),
	}, "|")))
	metadata, _ := json.Marshal(map[string]interface{}{
		"cli_version": Version,
	})

	run := platformsync.FlowRunSync{
		SourceFlowID: sourceFlowID,
		SourcePath:   sourcePath,
		RunnerType:   normalizeCLIRunnerType(runnerType),
		Profile:      profileName,
		Environment:  envName,
		BaseURL:      baseURL,
		Status:       result.Status(),
		TriggeredBy:  "cli",
		StartedAt:    startedAt.UTC(),
		FinishedAt:   finishedAt.UTC(),
		Error:        errorString(result.Err),
	}
	if result.LogPath != "" {
		run.LogPath = result.LogPath
		if content, excerpt, truncated := loadFlowRunLog(result.LogPath); content != "" {
			run.LogContent = content
			run.LogExcerpt = excerpt
			run.LogTruncated = truncated
		}
	}
	if result.Summary != nil {
		run.TotalSteps = result.Summary.TotalTests
		run.PassedSteps = result.Summary.PassedTests
		run.FailedSteps = result.Summary.FailedTests
		run.DurationMs = result.Summary.TotalTime.Milliseconds()
	}

	results := make([]platformsync.FlowRunResultSync, 0)
	if result.Summary != nil {
		results = make([]platformsync.FlowRunResultSync, 0, len(result.Summary.Results))
		for _, item := range result.Summary.Results {
			results = append(results, buildFlowRunResultSync(item))
		}
	}

	return platformsync.FlowRunSyncRequest{
		Source:        platformsync.FlowSyncSource,
		SourceEventID: sourceEventID,
		Metadata:      metadata,
		Run:           run,
		Results:       results,
	}
}

func runnableFlowSourceID(flow platformsync.RunnableFlow) string {
	if strings.TrimSpace(flow.SourceID) != "" {
		return strings.TrimSpace(flow.SourceID)
	}
	if strings.TrimSpace(flow.ID) != "" {
		return strings.TrimSpace(flow.ID)
	}
	if strings.TrimSpace(flow.SourcePath) != "" {
		return "path:" + strings.TrimSpace(flow.SourcePath)
	}
	return ""
}

func normalizeCLIRunnerType(runnerType string) string {
	switch strings.ToLower(strings.TrimSpace(runnerType)) {
	case "server_ci":
		return "server_ci"
	case "test_machine":
		return "test_machine"
	default:
		if strings.EqualFold(strings.TrimSpace(os.Getenv("CI")), "true") || strings.TrimSpace(os.Getenv("GITHUB_ACTIONS")) == "true" {
			return "server_ci"
		}
		return "test_machine"
	}
}

func loadFlowRunLog(logPath string) (string, string, bool) {
	content, err := os.ReadFile(logPath)
	if err != nil {
		return "", "", false
	}
	sanitized := platformsync.SanitizeLog(string(content))
	excerpt, truncated := platformsync.SanitizeLogExcerpt(string(content))
	return sanitized, excerpt, truncated
}

func buildFlowRunResultSync(result summary.TestResult) platformsync.FlowRunResultSync {
	status := "passed"
	if !result.Success {
		status = "failed"
	}
	requestBody, _ := platformsync.SanitizeBody(result.RequestBody)
	responseBody, _ := platformsync.SanitizeBody(result.ResponseBody)
	requestPayload, _ := json.Marshal(map[string]interface{}{
		"method":  result.Method,
		"url":     result.URL,
		"headers": platformsync.SanitizeStringMap(result.RequestHeaders),
		"body":    requestBody,
		"command": result.Command,
	})
	responsePayload, _ := json.Marshal(map[string]interface{}{
		"status":  result.Status,
		"headers": platformsync.SanitizeStringSliceMap(result.ResponseHeaders),
		"body":    responseBody,
	})

	return platformsync.FlowRunResultSync{
		SourceStepID: result.StepID,
		Name:         result.Name,
		Method:       result.Method,
		URL:          result.URL,
		Status:       status,
		HTTPStatus:   result.Status,
		Request:      string(requestPayload),
		Response:     string(responsePayload),
		DurationMs:   result.Duration.Milliseconds(),
		StartedAt:    result.StartTime.UTC(),
		Error:        errorString(result.Error),
	}
}

func printFlowSyncSummary(label string, resp platformsync.FlowSyncResponse) {
	fmt.Printf("\n✅ %s completed\n", label)
	fmt.Printf("   Created: %d\n", resp.Created)
	fmt.Printf("   Updated: %d\n", resp.Updated)
	fmt.Printf("   Skipped: %d\n", resp.Skipped)
	if len(resp.Errors) > 0 {
		fmt.Println("   Errors:")
		for _, err := range resp.Errors {
			fmt.Printf("   - %s\n", err)
		}
	}
}

func marshalStringList(values []string) string {
	cleaned := make([]string, 0, len(values))
	for _, value := range values {
		if trimmed := strings.TrimSpace(value); trimmed != "" {
			cleaned = append(cleaned, trimmed)
		}
	}
	if len(cleaned) == 0 {
		return ""
	}
	content, _ := json.Marshal(cleaned)
	return string(content)
}

func fileSHA1(path string) (string, error) {
	content, err := os.ReadFile(path)
	if err != nil {
		return "", err
	}
	return shortSHA1(string(content)), nil
}

func shortSHA1(value string) string {
	sum := sha1.Sum([]byte(value))
	return hex.EncodeToString(sum[:])[:16]
}

func errorString(err error) string {
	if err == nil {
		return ""
	}
	return err.Error()
}
