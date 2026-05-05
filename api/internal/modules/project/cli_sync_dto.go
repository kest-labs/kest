package project

import (
	"context"
	"encoding/json"
)

type SpecSyncer interface {
	SyncSpecsFromCLI(ctx context.Context, projectID string, req *CLISpecSyncRequest) (*CLISpecSyncResponseBody, error)
}

type CLISpecSyncRequest struct {
	ProjectID *string           `json:"project_id,omitempty"`
	Source    string            `json:"source"`
	Metadata  json.RawMessage   `json:"metadata,omitempty"`
	Specs     []CLISpecSyncSpec `json:"specs" binding:"required,min=1"`
}

type CLISpecSyncSpec struct {
	Method      string                         `json:"method" binding:"required,oneof=GET POST PUT DELETE PATCH HEAD OPTIONS"`
	Path        string                         `json:"path" binding:"required,max=500"`
	Title       string                         `json:"title" binding:"required,max=500"`
	Summary     string                         `json:"summary,omitempty"`
	Description string                         `json:"description,omitempty"`
	Version     string                         `json:"version" binding:"required,max=50"`
	RequestBody *CLISpecSyncRequestBody        `json:"request_body,omitempty"`
	Parameters  []CLISpecSyncParameter         `json:"parameters,omitempty"`
	Responses   map[string]CLISpecSyncResponse `json:"responses,omitempty"`
	Examples    []CLISpecSyncExample           `json:"examples,omitempty"`
}

type CLISpecSyncRequestBody struct {
	Description string                 `json:"description,omitempty"`
	Required    bool                   `json:"required"`
	ContentType string                 `json:"content_type"`
	Schema      map[string]interface{} `json:"schema"`
}

type CLISpecSyncParameter struct {
	Name        string                 `json:"name"`
	In          string                 `json:"in"`
	Description string                 `json:"description,omitempty"`
	Required    bool                   `json:"required"`
	Schema      map[string]interface{} `json:"schema"`
	Example     interface{}            `json:"example,omitempty"`
}

type CLISpecSyncResponse struct {
	Description string                 `json:"description"`
	ContentType string                 `json:"content_type"`
	Schema      map[string]interface{} `json:"schema"`
}

type CLISpecSyncExample struct {
	Name           string            `json:"name"`
	RequestHeaders map[string]string `json:"request_headers,omitempty"`
	RequestBody    string            `json:"request_body,omitempty"`
	ResponseStatus int               `json:"response_status"`
	ResponseBody   string            `json:"response_body,omitempty"`
	DurationMs     int64             `json:"duration_ms"`
}

type CLISpecSyncResponseBody struct {
	Created int      `json:"created"`
	Updated int      `json:"updated"`
	Skipped int      `json:"skipped"`
	Errors  []string `json:"errors,omitempty"`
}
