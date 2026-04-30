package project

import (
	"context"
	"encoding/json"
	"time"
)

type CLIHistorySyncer interface {
	SyncHistoryFromCLI(ctx context.Context, projectID string, createdBy uint, req *CLIHistorySyncRequest) (*CLIHistorySyncResponseBody, error)
}

type CLIHistorySyncRequest struct {
	ProjectID *string               `json:"project_id,omitempty"`
	Source    string                `json:"source"`
	Metadata  json.RawMessage       `json:"metadata,omitempty"`
	Entries   []CLIHistorySyncEntry `json:"entries" binding:"required,min=1"`
}

type CLIHistorySyncEntry struct {
	SourceEventID string                 `json:"source_event_id" binding:"required,max=191"`
	EventType     string                 `json:"event_type" binding:"required,max=50"`
	OccurredAt    time.Time              `json:"occurred_at" binding:"required"`
	EntityType    string                 `json:"entity_type" binding:"required,max=50"`
	EntityID      string                 `json:"entity_id" binding:"required"`
	Action        string                 `json:"action" binding:"required,max=20"`
	Message       string                 `json:"message" binding:"required,max=255"`
	Data          map[string]interface{} `json:"data" binding:"required"`
}

type CLIHistorySyncResponseBody struct {
	Created int      `json:"created"`
	Updated int      `json:"updated"`
	Skipped int      `json:"skipped"`
	Errors  []string `json:"errors,omitempty"`
}
