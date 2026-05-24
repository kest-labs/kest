package example

import "time"

// CreateExampleRequest is the request body for creating an example
type CreateExampleRequest struct {
	RequestID       string            `json:"request_id"`
	Name            string            `json:"name" binding:"required,min=1,max=100"`
	Description     string            `json:"description" binding:"max=500"`
	Category        string            `json:"category"`
	Source          string            `json:"source"`
	URL             string            `json:"url" binding:"max=2000"`
	Method          string            `json:"method"`
	Headers         []KeyValue        `json:"headers"`
	QueryParams     []KeyValue        `json:"query_params"`
	Body            string            `json:"body"`
	BodyType        string            `json:"body_type"`
	Auth            *AuthConfig       `json:"auth"`
	Assertions      []Assertion       `json:"assertions"`
	ResponseStatus  int               `json:"response_status"`
	ResponseHeaders map[string]string `json:"response_headers"`
	ResponseBody    string            `json:"response_body"`
	ResponseTime    int64             `json:"response_time"`
	IsDefault       bool              `json:"is_default"`
	SortOrder       int               `json:"sort_order"`
}

// UpdateExampleRequest is the request body for updating an example
type UpdateExampleRequest struct {
	Name        *string     `json:"name" binding:"omitempty,min=1,max=100"`
	Description *string     `json:"description" binding:"omitempty,max=500"`
	Category    *string     `json:"category"`
	Source      *string     `json:"source"`
	URL         *string     `json:"url" binding:"omitempty,max=2000"`
	Method      *string     `json:"method"`
	Headers     []KeyValue  `json:"headers"`
	QueryParams []KeyValue  `json:"query_params"`
	Body        *string     `json:"body"`
	BodyType    *string     `json:"body_type"`
	Auth        *AuthConfig `json:"auth"`
	Assertions  []Assertion `json:"assertions"`
	IsDefault   *bool       `json:"is_default"`
	SortOrder   *int        `json:"sort_order"`
}

// SaveResponseRequest is the request body for saving response to an example
type SaveResponseRequest struct {
	ResponseStatus  int               `json:"response_status"`
	ResponseHeaders map[string]string `json:"response_headers"`
	ResponseBody    string            `json:"response_body"`
	ResponseTime    int64             `json:"response_time"`
}

// GenerateAIExamplesRequest is the request body for AI-generated examples
type GenerateAIExamplesRequest struct {
	Count        int      `json:"count"`
	Categories   []string `json:"categories"`
	Instructions string   `json:"instructions" binding:"max=1200"`
	PreviewOnly  bool     `json:"preview_only"`
}

// GenerateAIExamplesResponse is the response for AI-generated examples
type GenerateAIExamplesResponse struct {
	Total       int                     `json:"total"`
	Items       []*ExampleResponse      `json:"items"`
	Drafts      []*ExampleDraftResponse `json:"drafts,omitempty"`
	PreviewOnly bool                    `json:"preview_only"`
}

// ExampleDraftResponse is the response for AI-generated examples that have not
// been accepted into saved examples yet.
type ExampleDraftResponse struct {
	Name            string            `json:"name"`
	Description     string            `json:"description"`
	Category        string            `json:"category"`
	Source          string            `json:"source"`
	URL             string            `json:"url"`
	Method          string            `json:"method"`
	Headers         []KeyValue        `json:"headers"`
	QueryParams     []KeyValue        `json:"query_params"`
	Body            string            `json:"body"`
	BodyType        string            `json:"body_type"`
	Auth            *AuthConfig       `json:"auth,omitempty"`
	Assertions      []Assertion       `json:"assertions"`
	ResponseStatus  int               `json:"response_status"`
	ResponseHeaders map[string]string `json:"response_headers"`
	ResponseBody    string            `json:"response_body"`
	SortOrder       int               `json:"sort_order"`
}

// ExampleResponse is the response for example endpoints
type ExampleResponse struct {
	ID              string            `json:"id"`
	RequestID       string            `json:"request_id"`
	Name            string            `json:"name"`
	Description     string            `json:"description"`
	Category        string            `json:"category"`
	Source          string            `json:"source"`
	URL             string            `json:"url"`
	Method          string            `json:"method"`
	Headers         []KeyValue        `json:"headers"`
	QueryParams     []KeyValue        `json:"query_params"`
	Body            string            `json:"body"`
	BodyType        string            `json:"body_type"`
	Auth            *AuthConfig       `json:"auth,omitempty"`
	Assertions      []Assertion       `json:"assertions"`
	ResponseStatus  int               `json:"response_status"`
	ResponseHeaders map[string]string `json:"response_headers"`
	ResponseBody    string            `json:"response_body"`
	ResponseTime    int64             `json:"response_time"`
	IsDefault       bool              `json:"is_default"`
	SortOrder       int               `json:"sort_order"`
	CreatedAt       time.Time         `json:"created_at"`
	UpdatedAt       time.Time         `json:"updated_at"`
}

// toResponse converts Example to ExampleResponse
func toResponse(e *Example) *ExampleResponse {
	if e == nil {
		return nil
	}
	return &ExampleResponse{
		ID:              e.ID,
		RequestID:       e.RequestID,
		Name:            e.Name,
		Description:     e.Description,
		Category:        e.Category,
		Source:          e.Source,
		URL:             e.URL,
		Method:          e.Method,
		Headers:         e.Headers,
		QueryParams:     e.QueryParams,
		Body:            e.Body,
		BodyType:        e.BodyType,
		Auth:            e.Auth,
		Assertions:      e.Assertions,
		ResponseStatus:  e.ResponseStatus,
		ResponseHeaders: e.ResponseHeaders,
		ResponseBody:    e.ResponseBody,
		ResponseTime:    e.ResponseTime,
		IsDefault:       e.IsDefault,
		SortOrder:       e.SortOrder,
		CreatedAt:       e.CreatedAt,
		UpdatedAt:       e.UpdatedAt,
	}
}

func toDraftResponse(req *CreateExampleRequest) *ExampleDraftResponse {
	if req == nil {
		return nil
	}
	return &ExampleDraftResponse{
		Name:            req.Name,
		Description:     req.Description,
		Category:        normalizeExampleCategory(req.Category),
		Source:          normalizeExampleSource(req.Source),
		URL:             req.URL,
		Method:          req.Method,
		Headers:         req.Headers,
		QueryParams:     req.QueryParams,
		Body:            req.Body,
		BodyType:        req.BodyType,
		Auth:            req.Auth,
		Assertions:      req.Assertions,
		ResponseStatus:  req.ResponseStatus,
		ResponseHeaders: req.ResponseHeaders,
		ResponseBody:    req.ResponseBody,
		SortOrder:       req.SortOrder,
	}
}

func toDraftResponseSlice(drafts []*CreateExampleRequest) []*ExampleDraftResponse {
	result := make([]*ExampleDraftResponse, len(drafts))
	for i, draft := range drafts {
		result[i] = toDraftResponse(draft)
	}
	return result
}

// toResponseSlice converts a slice of Examples to ExampleResponse slice
func toResponseSlice(examples []*Example) []*ExampleResponse {
	result := make([]*ExampleResponse, len(examples))
	for i, e := range examples {
		result[i] = toResponse(e)
	}
	return result
}
