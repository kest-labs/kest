package testcase

import (
	"encoding/json"
	"time"
)

// CreateTestCaseRequest represents the request to create a test case
type CreateTestCaseRequest struct {
	WorkspaceID string            `json:"workspace_id"`
	APISpecID   string            `json:"api_spec_id" binding:"required"`
	Name        string            `json:"name" binding:"required,max=255"`
	Description string            `json:"description,omitempty"`
	Env         string            `json:"env,omitempty" binding:"omitempty,max=50"`
	Headers     map[string]string `json:"headers,omitempty"`
	QueryParams map[string]string `json:"query_params,omitempty"`
	PathParams  map[string]string `json:"path_params,omitempty"`
	RequestBody any               `json:"request_body,omitempty"`
	PreScript   string            `json:"pre_script,omitempty"`
	PostScript  string            `json:"post_script,omitempty"`
	Assertions  []Assertion       `json:"assertions,omitempty"`
	ExtractVars []ExtractVar      `json:"extract_vars,omitempty"`
}

// UpdateTestCaseRequest represents the request to update a test case
type UpdateTestCaseRequest struct {
	Name        *string            `json:"name,omitempty" binding:"omitempty,max=255"`
	Description *string            `json:"description,omitempty"`
	Env         *string            `json:"env,omitempty" binding:"omitempty,max=50"`
	Headers     *map[string]string `json:"headers,omitempty"`
	QueryParams *map[string]string `json:"query_params,omitempty"`
	PathParams  *map[string]string `json:"path_params,omitempty"`
	RequestBody *any               `json:"request_body,omitempty"`
	PreScript   *string            `json:"pre_script,omitempty"`
	PostScript  *string            `json:"post_script,omitempty"`
	Assertions  *[]Assertion       `json:"assertions,omitempty"`
	ExtractVars *[]ExtractVar      `json:"extract_vars,omitempty"`
}

// TestCaseResponse represents the response for a test case
type TestCaseResponse struct {
	ID          string            `json:"id"`
	WorkspaceID string            `json:"workspace_id,omitempty"`
	APISpecID   string            `json:"api_spec_id"`
	Method      string            `json:"method,omitempty"`
	Path        string            `json:"path,omitempty"`
	Name        string            `json:"name"`
	Description string            `json:"description,omitempty"`
	Env         string            `json:"env,omitempty"`
	Headers     map[string]string `json:"headers,omitempty"`
	QueryParams map[string]string `json:"query_params,omitempty"`
	PathParams  map[string]string `json:"path_params,omitempty"`
	RequestBody any               `json:"request_body,omitempty"`
	PreScript   string            `json:"pre_script,omitempty"`
	PostScript  string            `json:"post_script,omitempty"`
	Assertions  []Assertion       `json:"assertions,omitempty"`
	ExtractVars []ExtractVar      `json:"extract_vars,omitempty"`
	CreatedBy   string            `json:"created_by"`
	CreatedAt   time.Time         `json:"created_at"`
	UpdatedAt   time.Time         `json:"updated_at"`
}

// FromSpecRequest represents the request to create a test case from an API spec
type FromSpecRequest struct {
	WorkspaceID string  `json:"workspace_id"`
	APISpecID   string  `json:"api_spec_id" binding:"required"`
	Name        string  `json:"name" binding:"required,max=255"`
	Env         string  `json:"env,omitempty" binding:"omitempty,max=50"`
	UseExample  bool    `json:"use_example,omitempty"`
	ExampleID   *string `json:"example_id,omitempty"`
}

// DuplicateRequest represents the request to duplicate a test case
type DuplicateRequest struct {
	Name string `json:"name" binding:"required,max=255"`
}

// ToTestCasePO converts CreateTestCaseRequest to TestCasePO
func (r *CreateTestCaseRequest) ToTestCasePO() (*TestCasePO, error) {
	tc := &TestCasePO{
		APISpecID:   r.APISpecID,
		Name:        r.Name,
		Description: r.Description,
		Env:         r.Env,
		PreScript:   r.PreScript,
		PostScript:  r.PostScript,
	}

	// Marshal JSON fields
	if r.Headers != nil {
		data, err := json.Marshal(r.Headers)
		if err != nil {
			return nil, err
		}
		tc.Headers = string(data)
	}

	if r.QueryParams != nil {
		data, err := json.Marshal(r.QueryParams)
		if err != nil {
			return nil, err
		}
		tc.QueryParams = string(data)
	}

	if r.PathParams != nil {
		data, err := json.Marshal(r.PathParams)
		if err != nil {
			return nil, err
		}
		tc.PathParams = string(data)
	}

	if r.RequestBody != nil {
		data, err := json.Marshal(r.RequestBody)
		if err != nil {
			return nil, err
		}
		tc.RequestBody = string(data)
	}

	if r.Assertions != nil {
		data, err := json.Marshal(r.Assertions)
		if err != nil {
			return nil, err
		}
		tc.Assertions = string(data)
	}

	if r.ExtractVars != nil {
		data, err := json.Marshal(r.ExtractVars)
		if err != nil {
			return nil, err
		}
		tc.ExtractVars = string(data)
	}

	return tc, nil
}

// ToResponse converts TestCasePO to TestCaseResponse
func (po *TestCasePO) ToResponse() (*TestCaseResponse, error) {
	resp := &TestCaseResponse{
		ID:          po.ID,
		APISpecID:   po.APISpecID,
		Name:        po.Name,
		Description: po.Description,
		Env:         po.Env,
		PreScript:   po.PreScript,
		PostScript:  po.PostScript,
		CreatedBy:   po.CreatedBy,
		CreatedAt:   po.CreatedAt,
		UpdatedAt:   po.UpdatedAt,
	}

	// Unmarshal JSON fields
	if po.Headers != "" {
		var headers map[string]string
		if err := json.Unmarshal([]byte(po.Headers), &headers); err != nil {
			return nil, err
		}
		resp.Headers = headers
	}

	if po.QueryParams != "" {
		var params map[string]string
		if err := json.Unmarshal([]byte(po.QueryParams), &params); err != nil {
			return nil, err
		}
		resp.QueryParams = params
	}

	if po.PathParams != "" {
		var params map[string]string
		if err := json.Unmarshal([]byte(po.PathParams), &params); err != nil {
			return nil, err
		}
		resp.PathParams = params
	}

	if po.RequestBody != "" {
		var body any
		if err := json.Unmarshal([]byte(po.RequestBody), &body); err != nil {
			return nil, err
		}
		resp.RequestBody = body
	}

	if po.Assertions != "" {
		var assertions []Assertion
		if err := json.Unmarshal([]byte(po.Assertions), &assertions); err != nil {
			return nil, err
		}
		resp.Assertions = assertions
	}

	if po.ExtractVars != "" {
		var extractVars []ExtractVar
		if err := json.Unmarshal([]byte(po.ExtractVars), &extractVars); err != nil {
			return nil, err
		}
		resp.ExtractVars = extractVars
	}

	return resp, nil
}

// ToResponseList converts a list of TestCasePO to TestCaseResponse
func ToResponseList(pos []*TestCasePO) ([]*TestCaseResponse, error) {
	responses := make([]*TestCaseResponse, 0, len(pos))
	for _, po := range pos {
		resp, err := po.ToResponse()
		if err != nil {
			return nil, err
		}
		responses = append(responses, resp)
	}
	return responses, nil
}

// PaginationMeta represents pagination metadata
type PaginationMeta struct {
	Page       int   `json:"page"`
	PageSize   int   `json:"page_size"`
	Total      int64 `json:"total"`
	TotalPages int   `json:"total_pages"`
}

// ========== Run DTOs ==========

type RunTestCaseRequest struct {
	EnvID        *string           `json:"env_id"`        // Optional: override environment
	GlobalVars   map[string]any    `json:"global_vars"`   // Optional: provided by caller (e.g. collection run)
	VariableKeys map[string]string `json:"variable_keys"` // Optional: override variables
}

type RunTestCaseResponse struct {
	TestCaseID string             `json:"test_case_id"`
	Status     string             `json:"status"` // pass, fail, error
	Message    string             `json:"message,omitempty"`
	DurationMs int64              `json:"duration_ms"`
	Request    *RunRequestInfo    `json:"request"`
	Response   *RunResponseInfo   `json:"response"`
	Assertions []*AssertionResult `json:"assertions"`
	Variables  map[string]any     `json:"variables"` // Extracted variables
}

type RunRequestInfo struct {
	Method  string            `json:"method"`
	URL     string            `json:"url"`
	Headers map[string]string `json:"headers"`
	Body    any               `json:"body,omitempty"`
}

type RunResponseInfo struct {
	Status  int               `json:"status"`
	Headers map[string]string `json:"headers"`
	Body    any               `json:"body,omitempty"`
}

type AssertionResult struct {
	Type     string `json:"type"`
	Operator string `json:"operator"`
	Path     string `json:"path"`
	Expect   any    `json:"expect"`
	Actual   any    `json:"actual"`
	Passed   bool   `json:"passed"`
	Message  string `json:"message"`
}

// TestRunResponse represents a single test run history record
type TestRunResponse struct {
	ID         string             `json:"id"`
	TestCaseID string             `json:"test_case_id"`
	Status     string             `json:"status"`
	DurationMs int64              `json:"duration_ms"`
	Request    *RunRequestInfo    `json:"request,omitempty"`
	Response   *RunResponseInfo   `json:"response,omitempty"`
	Assertions []*AssertionResult `json:"assertions,omitempty"`
	Variables  map[string]any     `json:"variables,omitempty"`
	Message    string             `json:"message,omitempty"`
	CreatedAt  time.Time          `json:"created_at"`
}

// ListRunsFilter is the filter for listing test run history
type ListRunsFilter struct {
	WorkspaceID string
	TestCaseID string
	Status     *string
	Page       int
	PageSize   int
}
