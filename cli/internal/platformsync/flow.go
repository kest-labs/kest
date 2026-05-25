package platformsync

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/kest-labs/kest/cli/internal/config"
)

const FlowSyncSource = "cli"

type FlowDefinitionSyncRequest struct {
	Source   string               `json:"source"`
	Metadata json.RawMessage      `json:"metadata,omitempty"`
	Flows    []FlowDefinitionSync `json:"flows"`
}

type FlowDefinitionSync struct {
	SourceID    string                 `json:"source_id"`
	SourcePath  string                 `json:"source_path"`
	SourceHash  string                 `json:"source_hash"`
	Name        string                 `json:"name"`
	Description string                 `json:"description,omitempty"`
	Version     string                 `json:"version,omitempty"`
	Environment string                 `json:"environment,omitempty"`
	Tags        []string               `json:"tags,omitempty"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
	ReadOnly    bool                   `json:"read_only"`
	Steps       []FlowStepSync         `json:"steps"`
	Edges       []FlowEdgeSync         `json:"edges"`
}

type FlowStepSync struct {
	SourceID  string  `json:"source_id"`
	Name      string  `json:"name"`
	SortOrder int     `json:"sort_order"`
	Type      string  `json:"type"`
	Method    string  `json:"method"`
	URL       string  `json:"url"`
	Headers   string  `json:"headers,omitempty"`
	Body      string  `json:"body,omitempty"`
	Captures  string  `json:"captures,omitempty"`
	Asserts   string  `json:"asserts,omitempty"`
	PositionX float64 `json:"position_x"`
	PositionY float64 `json:"position_y"`
}

type FlowEdgeSync struct {
	SourceStepID string `json:"source_step_id"`
	TargetStepID string `json:"target_step_id"`
	Condition    string `json:"condition,omitempty"`
}

type FlowRunSyncRequest struct {
	Source        string              `json:"source"`
	SourceEventID string              `json:"source_event_id"`
	Metadata      json.RawMessage     `json:"metadata,omitempty"`
	Run           FlowRunSync         `json:"run"`
	Results       []FlowRunResultSync `json:"results"`
}

type FlowRunSync struct {
	SourceFlowID string    `json:"source_flow_id,omitempty"`
	SourcePath   string    `json:"source_path"`
	Profile      string    `json:"profile,omitempty"`
	Environment  string    `json:"environment,omitempty"`
	BaseURL      string    `json:"base_url,omitempty"`
	Status       string    `json:"status"`
	TriggeredBy  string    `json:"triggered_by,omitempty"`
	StartedAt    time.Time `json:"started_at"`
	FinishedAt   time.Time `json:"finished_at"`
	TotalSteps   int       `json:"total_steps"`
	PassedSteps  int       `json:"passed_steps"`
	FailedSteps  int       `json:"failed_steps"`
	DurationMs   int64     `json:"duration_ms"`
	Error        string    `json:"error,omitempty"`
}

type FlowRunResultSync struct {
	SourceStepID string    `json:"source_step_id,omitempty"`
	Name         string    `json:"name"`
	Method       string    `json:"method"`
	URL          string    `json:"url,omitempty"`
	Status       string    `json:"status"`
	HTTPStatus   int       `json:"http_status,omitempty"`
	Request      string    `json:"request,omitempty"`
	Response     string    `json:"response,omitempty"`
	AssertResult string    `json:"assert_result,omitempty"`
	DurationMs   int64     `json:"duration_ms"`
	StartedAt    time.Time `json:"started_at"`
	Error        string    `json:"error,omitempty"`
}

type FlowSyncResponse struct {
	Created int      `json:"created"`
	Updated int      `json:"updated"`
	Skipped int      `json:"skipped"`
	Errors  []string `json:"errors,omitempty"`
}

func PushFlowDefinitions(conf *config.Config, workspaceID string, req FlowDefinitionSyncRequest) (FlowSyncResponse, error) {
	if len(req.Flows) == 0 {
		return FlowSyncResponse{}, nil
	}
	return postFlowSync(conf, buildWorkspaceCLIEndpoint(conf.PlatformURL, workspaceID, "flows/sync"), req)
}

func PushFlowRun(conf *config.Config, workspaceID string, req FlowRunSyncRequest) (FlowSyncResponse, error) {
	return postFlowSync(conf, buildWorkspaceCLIEndpoint(conf.PlatformURL, workspaceID, "flow-runs/sync"), req)
}

func postFlowSync(conf *config.Config, endpoint string, payload interface{}) (FlowSyncResponse, error) {
	if conf == nil {
		return FlowSyncResponse{}, fmt.Errorf("platform config is required")
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return FlowSyncResponse{}, err
	}

	httpReq, err := http.NewRequest(http.MethodPost, endpoint, bytes.NewBuffer(body))
	if err != nil {
		return FlowSyncResponse{}, err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+conf.PlatformToken)

	resp, err := (&http.Client{Timeout: 30 * time.Second}).Do(httpReq)
	if err != nil {
		return FlowSyncResponse{}, err
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		return FlowSyncResponse{}, fmt.Errorf("flow sync failed (%d): %s", resp.StatusCode, strings.TrimSpace(string(respBody)))
	}

	return ParseFlowSyncResponse(respBody)
}

func ParseFlowSyncResponse(body []byte) (FlowSyncResponse, error) {
	var wrapped historySyncEnvelope
	if err := json.Unmarshal(body, &wrapped); err == nil && len(wrapped.Data) > 0 {
		var resp FlowSyncResponse
		if err := json.Unmarshal(wrapped.Data, &resp); err != nil {
			return FlowSyncResponse{}, err
		}
		return resp, nil
	}

	var resp FlowSyncResponse
	if err := json.Unmarshal(body, &resp); err != nil {
		return FlowSyncResponse{}, err
	}
	return resp, nil
}

func buildWorkspaceCLIEndpoint(apiURL, workspaceID, suffix string) string {
	base := strings.TrimRight(strings.TrimSpace(apiURL), "/")
	suffix = strings.TrimLeft(suffix, "/")
	switch {
	case strings.HasSuffix(base, "/v1"), strings.HasSuffix(base, "/api/v1"):
		return fmt.Sprintf("%s/workspaces/%s/cli/%s", base, workspaceID, suffix)
	default:
		return fmt.Sprintf("%s/v1/workspaces/%s/cli/%s", base, workspaceID, suffix)
	}
}
