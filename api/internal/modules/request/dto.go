package request

import "time"

// CreateRequestRequest is the request body for creating a request
type CreateRequestRequest struct {
	CollectionID uint        `json:"collection_id"`
	Name         string      `json:"name" binding:"required,min=1,max=100"`
	Description  string      `json:"description" binding:"max=500"`
	Method       string      `json:"method" binding:"required,oneof=GET POST PUT PATCH DELETE HEAD OPTIONS"`
	URL          string      `json:"url" binding:"required,max=2000"`
	Headers      []KeyValue  `json:"headers"`
	QueryParams  []KeyValue  `json:"query_params"`
	PathParams   interface{} `json:"path_params"` // map[string]string or JSON string
	Body         string      `json:"body"`
	BodyType     string      `json:"body_type"`
	Auth         *AuthConfig `json:"auth"`
	PreRequest   string      `json:"pre_request"`
	Test         string      `json:"test"`
	SortOrder    int         `json:"sort_order"`
}

// UpdateRequestRequest is the request body for updating a request
type UpdateRequestRequest struct {
	Name        *string     `json:"name" binding:"omitempty,min=1,max=100"`
	Description *string     `json:"description" binding:"omitempty,max=500"`
	Method      *string     `json:"method" binding:"omitempty,oneof=GET POST PUT PATCH DELETE HEAD OPTIONS"`
	URL         *string     `json:"url" binding:"omitempty,max=2000"`
	Headers     []KeyValue  `json:"headers"`
	QueryParams []KeyValue  `json:"query_params"`
	PathParams  interface{} `json:"path_params"`
	Body        *string     `json:"body"`
	BodyType    *string     `json:"body_type"`
	Auth        *AuthConfig `json:"auth"`
	PreRequest  *string     `json:"pre_request"`
	Test        *string     `json:"test"`
	SortOrder   *int        `json:"sort_order"`
}

// MoveRequestRequest is the request body for moving a request
type MoveRequestRequest struct {
	CollectionID *uint `json:"collection_id,omitempty"`
	SortOrder    *int  `json:"sort_order,omitempty"`
}

// RequestResponse is the response for request endpoints
type RequestResponse struct {
	ID           uint              `json:"id"`
	CollectionID uint              `json:"collection_id"`
	Name         string            `json:"name"`
	Description  string            `json:"description"`
	Method       string            `json:"method"`
	URL          string            `json:"url"`
	Headers      []KeyValue        `json:"headers"`
	QueryParams  []KeyValue        `json:"query_params"`
	PathParams   map[string]string `json:"path_params"`
	Body         string            `json:"body"`
	BodyType     string            `json:"body_type"`
	Auth         *AuthConfig       `json:"auth,omitempty"`
	PreRequest   string            `json:"pre_request,omitempty"`
	Test         string            `json:"test,omitempty"`
	SortOrder    int               `json:"sort_order"`
	CreatedAt    time.Time         `json:"created_at"`
	UpdatedAt    time.Time         `json:"updated_at"`
}

// toResponse converts Request to RequestResponse
func toResponse(r *Request) *RequestResponse {
	if r == nil {
		return nil
	}
	return &RequestResponse{
		ID:           r.ID,
		CollectionID: r.CollectionID,
		Name:         r.Name,
		Description:  r.Description,
		Method:       r.Method,
		URL:          r.URL,
		Headers:      r.Headers,
		QueryParams:  r.QueryParams,
		PathParams:   r.PathParams,
		Body:         r.Body,
		BodyType:     r.BodyType,
		Auth:         r.Auth,
		PreRequest:   r.PreRequest,
		Test:         r.Test,
		SortOrder:    r.SortOrder,
		CreatedAt:    r.CreatedAt,
		UpdatedAt:    r.UpdatedAt,
	}
}

// toResponseSlice converts a slice of Requests to RequestResponse slice
func toResponseSlice(requests []*Request) []*RequestResponse {
	result := make([]*RequestResponse, len(requests))
	for i, r := range requests {
		result[i] = toResponse(r)
	}
	return result
}
