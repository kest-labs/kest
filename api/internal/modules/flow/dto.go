package flow

import "time"

// --- Flow DTOs ---

// CreateFlowRequest represents the request to create a flow
type CreateFlowRequest struct {
	Name        string `json:"name" binding:"required"`
	Description string `json:"description"`
}

// UpdateFlowRequest represents the request to update a flow
type UpdateFlowRequest struct {
	Name        *string `json:"name"`
	Description *string `json:"description"`
	Enabled     *bool   `json:"enabled"`
}

// FlowResponse represents the API response for a flow
type FlowResponse struct {
	ID              string     `json:"id"`
	WorkspaceID     string     `json:"workspace_id"`
	Name            string     `json:"name"`
	Description     string     `json:"description"`
	CreatedBy       string     `json:"created_by"`
	StepCount       int        `json:"step_count,omitempty"`
	Source          string     `json:"source"`
	SourceID        string     `json:"source_id"`
	SourcePath      string     `json:"source_path"`
	SourceHash      string     `json:"source_hash"`
	SourceReadOnly  bool       `json:"source_read_only"`
	Definition      string     `json:"definition,omitempty"`
	Revision        int        `json:"revision"`
	Enabled         bool       `json:"enabled"`
	Metadata        string     `json:"metadata,omitempty"`
	ParseStatus     string     `json:"parse_status"`
	ParseError      string     `json:"parse_error,omitempty"`
	ParsedAt        *time.Time `json:"parsed_at,omitempty"`
	LatestRunStatus string     `json:"latest_run_status,omitempty"`
	LatestRunMode   string     `json:"latest_run_mode,omitempty"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
}

// FlowDetailResponse includes steps and edges
type FlowDetailResponse struct {
	FlowResponse
	Steps []StepResponse `json:"steps"`
	Edges []EdgeResponse `json:"edges"`
}

// ImportFlowMarkdownRequest creates or updates a web-managed Markdown flow.
type ImportFlowMarkdownRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	SourcePath  string `json:"source_path"`
	Definition  string `json:"definition" binding:"required"`
	Enabled     *bool  `json:"enabled"`
}

// UpdateFlowMarkdownRequest updates the stored Markdown definition for a flow.
type UpdateFlowMarkdownRequest struct {
	Name        *string `json:"name"`
	Description *string `json:"description"`
	SourcePath  *string `json:"source_path"`
	Definition  string  `json:"definition" binding:"required"`
	Enabled     *bool   `json:"enabled"`
}

// ToFlowResponse converts FlowPO to FlowResponse
func ToFlowResponse(po *FlowPO) *FlowResponse {
	return &FlowResponse{
		ID:             po.ID,
		WorkspaceID:    po.WorkspaceID,
		Name:           po.Name,
		Description:    po.Description,
		CreatedBy:      po.CreatedBy,
		Source:         po.Source,
		SourceID:       po.SourceID,
		SourcePath:     po.SourcePath,
		SourceHash:     po.SourceHash,
		SourceReadOnly: po.SourceReadOnly,
		Definition:     po.Definition,
		Revision:       po.Revision,
		Enabled:        po.Enabled,
		Metadata:       po.Metadata,
		ParseStatus:    po.ParseStatus,
		ParseError:     po.ParseError,
		ParsedAt:       po.ParsedAt,
		CreatedAt:      po.CreatedAt,
		UpdatedAt:      po.UpdatedAt,
	}
}

// --- Step DTOs ---

// CreateStepRequest represents the request to create a step
type CreateStepRequest struct {
	ClientKey string  `json:"client_key"`
	Name      string  `json:"name" binding:"required"`
	SortOrder int     `json:"sort_order"`
	Method    string  `json:"method" binding:"required"`
	URL       string  `json:"url" binding:"required"`
	Headers   string  `json:"headers"`
	Body      string  `json:"body"`
	Captures  string  `json:"captures"`
	Asserts   string  `json:"asserts"`
	PositionX float64 `json:"position_x"`
	PositionY float64 `json:"position_y"`
}

// UpdateStepRequest represents the request to update a step
type UpdateStepRequest struct {
	ClientKey *string  `json:"client_key"`
	Name      *string  `json:"name"`
	SortOrder *int     `json:"sort_order"`
	Method    *string  `json:"method"`
	URL       *string  `json:"url"`
	Headers   *string  `json:"headers"`
	Body      *string  `json:"body"`
	Captures  *string  `json:"captures"`
	Asserts   *string  `json:"asserts"`
	PositionX *float64 `json:"position_x"`
	PositionY *float64 `json:"position_y"`
}

// StepResponse represents the API response for a step
type StepResponse struct {
	ID        string    `json:"id"`
	FlowID    string    `json:"flow_id"`
	ClientKey string    `json:"client_key"`
	Name      string    `json:"name"`
	SortOrder int       `json:"sort_order"`
	Method    string    `json:"method"`
	URL       string    `json:"url"`
	Headers   string    `json:"headers"`
	Body      string    `json:"body"`
	Captures  string    `json:"captures"`
	Asserts   string    `json:"asserts"`
	StepType  string    `json:"step_type"`
	SourceID  string    `json:"source_id"`
	PositionX float64   `json:"position_x"`
	PositionY float64   `json:"position_y"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// ToStepResponse converts FlowStepPO to StepResponse
func ToStepResponse(po *FlowStepPO) *StepResponse {
	return &StepResponse{
		ID:        po.ID,
		FlowID:    po.FlowID,
		ClientKey: normalizeStepClientKey(po.ID, po.ClientKey),
		Name:      po.Name,
		SortOrder: po.SortOrder,
		Method:    po.Method,
		URL:       po.URL,
		Headers:   po.Headers,
		Body:      po.Body,
		Captures:  po.Captures,
		Asserts:   po.Asserts,
		StepType:  po.StepType,
		SourceID:  po.SourceID,
		PositionX: po.PositionX,
		PositionY: po.PositionY,
		CreatedAt: po.CreatedAt,
		UpdatedAt: po.UpdatedAt,
	}
}

// --- Edge DTOs ---

// CreateEdgeRequest represents the request to create an edge
type CreateEdgeRequest struct {
	SourceStepID    string `json:"source_step_id" binding:"required"`
	TargetStepID    string `json:"target_step_id" binding:"required"`
	VariableMapping string `json:"variable_mapping"`
}

// UpdateEdgeRequest represents the request to update an edge
type UpdateEdgeRequest struct {
	SourceStepID    *string `json:"source_step_id"`
	TargetStepID    *string `json:"target_step_id"`
	VariableMapping *string `json:"variable_mapping"`
}

// EdgeResponse represents the API response for an edge
type EdgeResponse struct {
	ID                   string                `json:"id"`
	FlowID               string                `json:"flow_id"`
	SourceStepID         string                `json:"source_step_id"`
	TargetStepID         string                `json:"target_step_id"`
	VariableMapping      string                `json:"variable_mapping"`
	VariableMappingRules []VariableMappingRule `json:"variable_mapping_rules,omitempty"`
	CreatedAt            time.Time             `json:"created_at"`
	UpdatedAt            time.Time             `json:"updated_at"`
}

// ToEdgeResponse converts FlowEdgePO to EdgeResponse
func ToEdgeResponse(po *FlowEdgePO) *EdgeResponse {
	rules, _ := parseVariableMappingRules(po.VariableMapping)
	return &EdgeResponse{
		ID:                   po.ID,
		FlowID:               po.FlowID,
		SourceStepID:         po.SourceStepID,
		TargetStepID:         po.TargetStepID,
		VariableMapping:      po.VariableMapping,
		VariableMappingRules: rules,
		CreatedAt:            po.CreatedAt,
		UpdatedAt:            po.UpdatedAt,
	}
}

// --- Run DTOs ---

// RunResponse represents the API response for a flow run
type RunResponse struct {
	ID            string               `json:"id"`
	FlowID        string               `json:"flow_id"`
	Status        string               `json:"status"`
	TriggeredBy   string               `json:"triggered_by"`
	ExecutionMode string               `json:"execution_mode"`
	Source        string               `json:"source"`
	SourceEventID string               `json:"source_event_id"`
	RunnerType    string               `json:"runner_type"`
	Profile       string               `json:"profile"`
	Environment   string               `json:"environment"`
	BaseURL       string               `json:"base_url"`
	TotalSteps    int                  `json:"total_steps"`
	PassedSteps   int                  `json:"passed_steps"`
	FailedSteps   int                  `json:"failed_steps"`
	DurationMs    int64                `json:"duration_ms"`
	ErrorMessage  string               `json:"error_message"`
	LogContent    string               `json:"log_content"`
	LogPath       string               `json:"log_path"`
	LogExcerpt    string               `json:"log_excerpt"`
	LogTruncated  bool                 `json:"log_truncated"`
	StartedAt     *time.Time           `json:"started_at"`
	FinishedAt    *time.Time           `json:"finished_at"`
	CreatedAt     time.Time            `json:"created_at"`
	UpdatedAt     time.Time            `json:"updated_at"`
	StepResults   []StepResultResponse `json:"step_results,omitempty"`
}

type FlowRunListFilter struct {
	RunnerType string
	Status     string
	Source     string
	Profile    string
	From       *time.Time
	To         *time.Time
}

// ToRunResponse converts FlowRunPO to RunResponse
func ToRunResponse(po *FlowRunPO) *RunResponse {
	return &RunResponse{
		ID:            po.ID,
		FlowID:        po.FlowID,
		Status:        po.Status,
		TriggeredBy:   po.TriggeredBy,
		ExecutionMode: po.ExecutionMode,
		Source:        po.Source,
		SourceEventID: po.SourceEventID,
		RunnerType:    po.RunnerType,
		Profile:       po.Profile,
		Environment:   po.Environment,
		BaseURL:       po.BaseURL,
		TotalSteps:    po.TotalSteps,
		PassedSteps:   po.PassedSteps,
		FailedSteps:   po.FailedSteps,
		DurationMs:    po.DurationMs,
		ErrorMessage:  po.ErrorMessage,
		LogContent:    po.LogContent,
		LogPath:       po.LogPath,
		LogExcerpt:    po.LogExcerpt,
		LogTruncated:  po.LogTruncated,
		StartedAt:     po.StartedAt,
		FinishedAt:    po.FinishedAt,
		CreatedAt:     po.CreatedAt,
		UpdatedAt:     po.UpdatedAt,
	}
}

// StepResultResponse represents the API response for a step result
type StepResultResponse struct {
	ID                string    `json:"id"`
	RunID             string    `json:"run_id"`
	StepID            string    `json:"step_id"`
	Status            string    `json:"status"`
	Request           string    `json:"request"`
	Response          string    `json:"response"`
	AssertResults     string    `json:"assert_results"`
	DurationMs        int64     `json:"duration_ms"`
	VariablesCaptured string    `json:"variables_captured"`
	ErrorMessage      string    `json:"error_message"`
	CreatedAt         time.Time `json:"created_at"`
}

// ToStepResultResponse converts FlowStepResultPO to StepResultResponse
func ToStepResultResponse(po *FlowStepResultPO) *StepResultResponse {
	return &StepResultResponse{
		ID:                po.ID,
		RunID:             po.RunID,
		StepID:            po.StepID,
		Status:            po.Status,
		Request:           po.Request,
		Response:          po.Response,
		AssertResults:     po.AssertResults,
		DurationMs:        po.DurationMs,
		VariablesCaptured: po.VariablesCaptured,
		ErrorMessage:      po.ErrorMessage,
		CreatedAt:         po.CreatedAt,
	}
}

// --- Batch Save DTOs ---

// SaveStepRequest represents a React Flow node save payload.
type SaveStepRequest struct {
	ClientKey string  `json:"client_key"`
	Name      string  `json:"name"`
	SortOrder int     `json:"sort_order"`
	Method    string  `json:"method"`
	URL       string  `json:"url"`
	Headers   string  `json:"headers"`
	Body      string  `json:"body"`
	Captures  string  `json:"captures"`
	Asserts   string  `json:"asserts"`
	PositionX float64 `json:"position_x"`
	PositionY float64 `json:"position_y"`
}

// SaveEdgeRequest represents a React Flow edge save payload.
type SaveEdgeRequest struct {
	SourceClientKey string `json:"source_client_key"`
	TargetClientKey string `json:"target_client_key"`
	VariableMapping string `json:"variable_mapping"`
}

// SaveFlowRequest represents a full flow save (steps + edges in one request)
type SaveFlowRequest struct {
	Name        *string           `json:"name"`
	Description *string           `json:"description"`
	Steps       []SaveStepRequest `json:"steps"`
	Edges       []SaveEdgeRequest `json:"edges"`
}

// --- CLI flow sync DTOs ---

type CLIFlowSyncRequest struct {
	Source   string                 `json:"source"`
	Metadata map[string]interface{} `json:"metadata,omitempty"`
	Flows    []CLIFlowSyncItem      `json:"flows" binding:"required,min=1"`
}

type CLIFlowSyncItem struct {
	SourceID    string                 `json:"source_id" binding:"required"`
	SourcePath  string                 `json:"source_path" binding:"required"`
	SourceHash  string                 `json:"source_hash"`
	Name        string                 `json:"name" binding:"required"`
	Description string                 `json:"description"`
	Version     string                 `json:"version"`
	Environment string                 `json:"environment"`
	Tags        []string               `json:"tags"`
	Metadata    map[string]interface{} `json:"metadata"`
	ReadOnly    bool                   `json:"read_only"`
	Steps       []CLIFlowStepSyncItem  `json:"steps"`
	Edges       []CLIFlowEdgeSyncItem  `json:"edges"`
}

type CLIFlowStepSyncItem struct {
	SourceID  string  `json:"source_id" binding:"required"`
	Name      string  `json:"name" binding:"required"`
	SortOrder int     `json:"sort_order"`
	Type      string  `json:"type"`
	Method    string  `json:"method"`
	URL       string  `json:"url"`
	Headers   string  `json:"headers"`
	Body      string  `json:"body"`
	Captures  string  `json:"captures"`
	Asserts   string  `json:"asserts"`
	PositionX float64 `json:"position_x"`
	PositionY float64 `json:"position_y"`
}

type CLIFlowEdgeSyncItem struct {
	SourceStepID string `json:"source_step_id" binding:"required"`
	TargetStepID string `json:"target_step_id" binding:"required"`
	Condition    string `json:"condition"`
}

type CLIFlowRunSyncRequest struct {
	Source        string                     `json:"source"`
	SourceEventID string                     `json:"source_event_id" binding:"required,max=191"`
	Metadata      map[string]interface{}     `json:"metadata,omitempty"`
	Run           CLIFlowRunSyncItem         `json:"run" binding:"required"`
	Results       []CLIFlowRunResultSyncItem `json:"results"`
}

type CLIFlowRunSyncItem struct {
	SourceFlowID string    `json:"source_flow_id"`
	SourcePath   string    `json:"source_path" binding:"required"`
	RunnerType   string    `json:"runner_type"`
	Profile      string    `json:"profile"`
	Environment  string    `json:"environment"`
	BaseURL      string    `json:"base_url"`
	Status       string    `json:"status" binding:"required"`
	TriggeredBy  string    `json:"triggered_by"`
	StartedAt    time.Time `json:"started_at" binding:"required"`
	FinishedAt   time.Time `json:"finished_at" binding:"required"`
	TotalSteps   int       `json:"total_steps"`
	PassedSteps  int       `json:"passed_steps"`
	FailedSteps  int       `json:"failed_steps"`
	DurationMs   int64     `json:"duration_ms"`
	Error        string    `json:"error"`
	LogContent   string    `json:"log_content"`
	LogPath      string    `json:"log_path"`
	LogExcerpt   string    `json:"log_excerpt"`
	LogTruncated bool      `json:"log_truncated"`
}

type CLIFlowRunResultSyncItem struct {
	SourceStepID string    `json:"source_step_id"`
	Name         string    `json:"name" binding:"required"`
	Method       string    `json:"method"`
	URL          string    `json:"url"`
	Status       string    `json:"status" binding:"required"`
	HTTPStatus   int       `json:"http_status"`
	Request      string    `json:"request"`
	Response     string    `json:"response"`
	AssertResult string    `json:"assert_result"`
	DurationMs   int64     `json:"duration_ms"`
	StartedAt    time.Time `json:"started_at"`
	Error        string    `json:"error"`
}

type CLIFlowSyncResponseBody struct {
	Created int      `json:"created"`
	Updated int      `json:"updated"`
	Skipped int      `json:"skipped"`
	Errors  []string `json:"errors,omitempty"`
}

type CLIRunnableFlowResponse struct {
	ID          string    `json:"id"`
	SourceID    string    `json:"source_id"`
	SourcePath  string    `json:"source_path"`
	SourceHash  string    `json:"source_hash"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	Definition  string    `json:"definition"`
	Revision    int       `json:"revision"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type CIWebhookRequest struct {
	EventID   string                 `json:"event_id"`
	Provider  string                 `json:"provider"`
	Ref       string                 `json:"ref"`
	CommitSHA string                 `json:"commit_sha"`
	Profile   string                 `json:"profile"`
	BaseURL   string                 `json:"base_url"`
	Metadata  map[string]interface{} `json:"metadata,omitempty"`
}

type CIWebhookResponse struct {
	Accepted          bool                   `json:"accepted"`
	WorkspaceID       string                 `json:"workspace_id"`
	EventID           string                 `json:"event_id"`
	RunnerType        string                 `json:"runner_type"`
	Profile           string                 `json:"profile"`
	BaseURL           string                 `json:"base_url,omitempty"`
	RunnableFlowCount int                    `json:"runnable_flow_count"`
	Command           string                 `json:"command"`
	Metadata          map[string]interface{} `json:"metadata,omitempty"`
}
