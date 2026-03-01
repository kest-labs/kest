package apispec

import (
	"encoding/json"
	"time"
)

// ========== Request DTOs ==========

type CreateAPISpecRequest struct {
	ProjectID     uint                    `json:"project_id"`
	CategoryID    *uint                   `json:"category_id"`
	Method        string                  `json:"method" binding:"required,oneof=GET POST PUT DELETE PATCH HEAD OPTIONS"`
	Path          string                  `json:"path" binding:"required,max=500"`
	Summary       string                  `json:"summary" binding:"omitempty,max=500"`
	Description   string                  `json:"description"`
	DocMarkdown   string                  `json:"doc_markdown"`
	DocMarkdownZh string                  `json:"doc_markdown_zh"`
	DocMarkdownEn string                  `json:"doc_markdown_en"`
	DocSource     string                  `json:"doc_source" binding:"omitempty,oneof=manual ai"`
	Tags          []string                `json:"tags"`
	RequestBody   *RequestBodySpec        `json:"request_body"`
	Parameters    []ParameterSpec         `json:"parameters"`
	Responses     map[string]ResponseSpec `json:"responses"`
	Version       string                  `json:"version" binding:"required,max=50"`
	IsPublic      *bool                   `json:"is_public"`
}

type UpdateAPISpecRequest struct {
	CategoryID    *uint                    `json:"category_id"`
	Summary       *string                  `json:"summary" binding:"omitempty,max=500"`
	Description   *string                  `json:"description"`
	DocMarkdown   *string                  `json:"doc_markdown"`
	DocMarkdownZh *string                  `json:"doc_markdown_zh"`
	DocMarkdownEn *string                  `json:"doc_markdown_en"`
	DocSource     *string                  `json:"doc_source" binding:"omitempty,oneof=manual ai"`
	Tags          *[]string                `json:"tags"`
	RequestBody   *RequestBodySpec         `json:"request_body"`
	Parameters    *[]ParameterSpec         `json:"parameters"`
	Responses     *map[string]ResponseSpec `json:"responses"`
	IsPublic      *bool                    `json:"is_public"`
}

type BatchGenDocRequest struct {
	CategoryID *uint  `json:"category_id"`
	Lang       string `json:"lang"`
	Force      bool   `json:"force"`
}

type BatchGenDocResponse struct {
	Total   int `json:"total"`
	Queued  int `json:"queued"`
	Skipped int `json:"skipped"`
}

type CreateAPIExampleRequest struct {
	APISpecID      uint              `json:"api_spec_id"`
	Name           string            `json:"name" binding:"required,max=255"`
	RequestHeaders map[string]string `json:"request_headers"`
	RequestBody    json.RawMessage   `json:"request_body"`
	ResponseStatus int               `json:"response_status" binding:"required,min=100,max=599"`
	ResponseBody   json.RawMessage   `json:"response_body"`
	DurationMs     int64             `json:"duration_ms"`
}

// ========== Response DTOs ==========

type APISpecResponse struct {
	ID             uint                    `json:"id"`
	ProjectID      uint                    `json:"project_id"`
	CategoryID     *uint                   `json:"category_id,omitempty"`
	Method         string                  `json:"method"`
	Path           string                  `json:"path"`
	Summary        string                  `json:"summary"`
	Description    string                  `json:"description"`
	DocMarkdown    string                  `json:"doc_markdown,omitempty"`
	DocMarkdownZh  string                  `json:"doc_markdown_zh,omitempty"`
	DocMarkdownEn  string                  `json:"doc_markdown_en,omitempty"`
	DocSource      string                  `json:"doc_source,omitempty"`
	DocUpdatedAt   *time.Time              `json:"doc_updated_at,omitempty"`
	DocUpdatedAtZh *time.Time              `json:"doc_updated_at_zh,omitempty"`
	DocUpdatedAtEn *time.Time              `json:"doc_updated_at_en,omitempty"`
	TestContent    string                  `json:"test_content,omitempty"`
	TestSource     string                  `json:"test_source,omitempty"`
	TestUpdatedAt  *time.Time              `json:"test_updated_at,omitempty"`
	Tags           []string                `json:"tags"`
	RequestBody    *RequestBodySpec        `json:"request_body,omitempty"`
	Parameters     []ParameterSpec         `json:"parameters,omitempty"`
	Responses      map[string]ResponseSpec `json:"responses,omitempty"`
	Examples       []APIExampleResponse    `json:"examples,omitempty"`
	Version        string                  `json:"version"`
	IsPublic       bool                    `json:"is_public"`
	CreatedAt      time.Time               `json:"created_at"`
	UpdatedAt      time.Time               `json:"updated_at"`
}

type APIExampleResponse struct {
	ID             uint              `json:"id"`
	APISpecID      uint              `json:"api_spec_id"`
	Name           string            `json:"name"`
	RequestHeaders map[string]string `json:"request_headers,omitempty"`
	RequestBody    json.RawMessage   `json:"request_body,omitempty"`
	ResponseStatus int               `json:"response_status"`
	ResponseBody   json.RawMessage   `json:"response_body,omitempty"`
	DurationMs     int64             `json:"duration_ms"`
	CreatedAt      time.Time         `json:"created_at"`
}

// ========== Schema Specs (OpenAPI-like) ==========

type RequestBodySpec struct {
	Description string                 `json:"description,omitempty"`
	Required    bool                   `json:"required"`
	ContentType string                 `json:"content_type"` // application/json, multipart/form-data, etc.
	Schema      map[string]interface{} `json:"schema"`
}

type ParameterSpec struct {
	Name        string                 `json:"name"`
	In          string                 `json:"in"` // query, header, path, cookie
	Description string                 `json:"description,omitempty"`
	Required    bool                   `json:"required"`
	Schema      map[string]interface{} `json:"schema"`
	Example     interface{}            `json:"example,omitempty"`
}

type ResponseSpec struct {
	Description string                 `json:"description"`
	ContentType string                 `json:"content_type"`
	Schema      map[string]interface{} `json:"schema"`
}

// ========== Mapper Functions ==========

// ToAPISpecPO converts domain request to persistent object
func ToAPISpecPO(req *CreateAPISpecRequest) *APISpecPO {
	po := &APISpecPO{
		ProjectID:     req.ProjectID,
		Method:        req.Method,
		Path:          req.Path,
		Summary:       req.Summary,
		Description:   req.Description,
		DocMarkdown:   req.DocMarkdown,
		DocMarkdownZh: req.DocMarkdownZh,
		DocMarkdownEn: req.DocMarkdownEn,
		DocSource:     "manual",
		Version:       req.Version,
		CategoryID:    req.CategoryID,
	}

	if req.DocSource != "" {
		po.DocSource = req.DocSource
	}
	if req.DocMarkdown != "" {
		now := time.Now()
		po.DocUpdatedAt = &now
	}
	if req.DocMarkdownZh != "" {
		now := time.Now()
		po.DocUpdatedAtZh = &now
	}
	if req.DocMarkdownEn != "" {
		now := time.Now()
		po.DocUpdatedAtEn = &now
	}

	// Convert tags
	if req.Tags != nil {
		tagsJSON, _ := json.Marshal(req.Tags)
		po.Tags = string(tagsJSON)
	}

	// Convert request body
	if req.RequestBody != nil {
		reqBodyJSON, _ := json.Marshal(req.RequestBody)
		po.RequestBody = string(reqBodyJSON)
	}

	// Convert parameters
	if req.Parameters != nil {
		paramsJSON, _ := json.Marshal(req.Parameters)
		po.Parameters = string(paramsJSON)
	}

	// Convert responses
	if req.Responses != nil {
		responsesJSON, _ := json.Marshal(req.Responses)
		po.Responses = string(responsesJSON)
	}

	// Set is_public
	if req.IsPublic != nil {
		po.IsPublic = *req.IsPublic
	} else {
		po.IsPublic = true
	}

	return po
}

// FromAPISpecPO converts persistent object to response DTO
func FromAPISpecPO(po *APISpecPO) *APISpecResponse {
	if po == nil {
		return nil
	}

	resp := &APISpecResponse{
		ID:             po.ID,
		ProjectID:      po.ProjectID,
		Method:         po.Method,
		Path:           po.Path,
		Summary:        po.Summary,
		Description:    po.Description,
		DocMarkdown:    po.DocMarkdown,
		DocMarkdownZh:  po.DocMarkdownZh,
		DocMarkdownEn:  po.DocMarkdownEn,
		DocSource:      po.DocSource,
		DocUpdatedAt:   po.DocUpdatedAt,
		DocUpdatedAtZh: po.DocUpdatedAtZh,
		DocUpdatedAtEn: po.DocUpdatedAtEn,
		TestContent:    po.TestContent,
		TestSource:     po.TestSource,
		TestUpdatedAt:  po.TestUpdatedAt,
		Version:        po.Version,
		IsPublic:       po.IsPublic,
		CreatedAt:      po.CreatedAt,
		UpdatedAt:      po.UpdatedAt,
		CategoryID:     po.CategoryID,
	}

	// Parse tags
	if po.Tags != "" {
		json.Unmarshal([]byte(po.Tags), &resp.Tags)
	}

	// Parse request body
	if po.RequestBody != "" {
		var reqBody RequestBodySpec
		if json.Unmarshal([]byte(po.RequestBody), &reqBody) == nil {
			resp.RequestBody = &reqBody
		}
	}

	// Parse parameters
	if po.Parameters != "" {
		json.Unmarshal([]byte(po.Parameters), &resp.Parameters)
	}

	// Parse responses
	if po.Responses != "" {
		json.Unmarshal([]byte(po.Responses), &resp.Responses)
	}

	return resp
}

// ToAPIExamplePO converts request to persistent object
func ToAPIExamplePO(req *CreateAPIExampleRequest) *APIExamplePO {
	po := &APIExamplePO{
		APISpecID:      req.APISpecID,
		Name:           req.Name,
		ResponseStatus: req.ResponseStatus,
		DurationMs:     req.DurationMs,
	}

	// Convert request headers
	if req.RequestHeaders != nil {
		headersJSON, _ := json.Marshal(req.RequestHeaders)
		po.RequestHeaders = string(headersJSON)
	}

	// Convert bodies
	if req.RequestBody != nil {
		po.RequestBody = string(req.RequestBody)
	}
	if req.ResponseBody != nil {
		po.ResponseBody = string(req.ResponseBody)
	}

	return po
}

// FromAPIExamplePO converts persistent object to response DTO
func FromAPIExamplePO(po *APIExamplePO) *APIExampleResponse {
	if po == nil {
		return nil
	}

	resp := &APIExampleResponse{
		ID:             po.ID,
		APISpecID:      po.APISpecID,
		Name:           po.Name,
		ResponseStatus: po.ResponseStatus,
		DurationMs:     po.DurationMs,
		CreatedAt:      po.CreatedAt,
	}

	// Parse request headers
	if po.RequestHeaders != "" {
		json.Unmarshal([]byte(po.RequestHeaders), &resp.RequestHeaders)
	}

	// Parse bodies
	if po.RequestBody != "" {
		resp.RequestBody = json.RawMessage(po.RequestBody)
	}
	if po.ResponseBody != "" {
		resp.ResponseBody = json.RawMessage(po.ResponseBody)
	}

	return resp
}
