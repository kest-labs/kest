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
}

// FlowResponse represents the API response for a flow
type FlowResponse struct {
	ID          string    `json:"id"`
	WorkspaceID string    `json:"workspace_id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	CreatedBy   string    `json:"created_by"`
	StepCount   int       `json:"step_count,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// FlowDetailResponse includes steps and edges
type FlowDetailResponse struct {
	FlowResponse
	Steps []StepResponse `json:"steps"`
	Edges []EdgeResponse `json:"edges"`
}

// ToFlowResponse converts FlowPO to FlowResponse
func ToFlowResponse(po *FlowPO) *FlowResponse {
	return &FlowResponse{
		ID:          po.ID,
		WorkspaceID: po.WorkspaceID,
		Name:        po.Name,
		Description: po.Description,
		CreatedBy:   po.CreatedBy,
		CreatedAt:   po.CreatedAt,
		UpdatedAt:   po.UpdatedAt,
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
	ID          string               `json:"id"`
	FlowID      string               `json:"flow_id"`
	Status      string               `json:"status"`
	TriggeredBy string               `json:"triggered_by"`
	StartedAt   *time.Time           `json:"started_at"`
	FinishedAt  *time.Time           `json:"finished_at"`
	CreatedAt   time.Time            `json:"created_at"`
	UpdatedAt   time.Time            `json:"updated_at"`
	StepResults []StepResultResponse `json:"step_results,omitempty"`
}

// ToRunResponse converts FlowRunPO to RunResponse
func ToRunResponse(po *FlowRunPO) *RunResponse {
	return &RunResponse{
		ID:          po.ID,
		FlowID:      po.FlowID,
		Status:      po.Status,
		TriggeredBy: po.TriggeredBy,
		StartedAt:   po.StartedAt,
		FinishedAt:  po.FinishedAt,
		CreatedAt:   po.CreatedAt,
		UpdatedAt:   po.UpdatedAt,
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
