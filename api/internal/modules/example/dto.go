package example

import "time"

// CreateExampleRequest is the request body for creating an example
type CreateExampleRequest struct {
	RequestID   uint        `json:"request_id"`
	Name        string      `json:"name" binding:"required,min=1,max=100"`
	Description string      `json:"description" binding:"max=500"`
	URL         string      `json:"url" binding:"max=2000"`
	Method      string      `json:"method"`
	Headers     []KeyValue  `json:"headers"`
	QueryParams []KeyValue  `json:"query_params"`
	Body        string      `json:"body"`
	BodyType    string      `json:"body_type"`
	Auth        *AuthConfig `json:"auth"`
	IsDefault   bool        `json:"is_default"`
	SortOrder   int         `json:"sort_order"`
}

// UpdateExampleRequest is the request body for updating an example
type UpdateExampleRequest struct {
	Name        *string     `json:"name" binding:"omitempty,min=1,max=100"`
	Description *string     `json:"description" binding:"omitempty,max=500"`
	URL         *string     `json:"url" binding:"omitempty,max=2000"`
	Method      *string     `json:"method"`
	Headers     []KeyValue  `json:"headers"`
	QueryParams []KeyValue  `json:"query_params"`
	Body        *string     `json:"body"`
	BodyType    *string     `json:"body_type"`
	Auth        *AuthConfig `json:"auth"`
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

// ExampleResponse is the response for example endpoints
type ExampleResponse struct {
	ID              uint              `json:"id"`
	RequestID       uint              `json:"request_id"`
	Name            string            `json:"name"`
	Description     string            `json:"description"`
	URL             string            `json:"url"`
	Method          string            `json:"method"`
	Headers         []KeyValue        `json:"headers"`
	QueryParams     []KeyValue        `json:"query_params"`
	Body            string            `json:"body"`
	BodyType        string            `json:"body_type"`
	Auth            *AuthConfig       `json:"auth,omitempty"`
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
		URL:             e.URL,
		Method:          e.Method,
		Headers:         e.Headers,
		QueryParams:     e.QueryParams,
		Body:            e.Body,
		BodyType:        e.BodyType,
		Auth:            e.Auth,
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

// toResponseSlice converts a slice of Examples to ExampleResponse slice
func toResponseSlice(examples []*Example) []*ExampleResponse {
	result := make([]*ExampleResponse, len(examples))
	for i, e := range examples {
		result[i] = toResponse(e)
	}
	return result
}
