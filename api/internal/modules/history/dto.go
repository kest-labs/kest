package history

import "time"

// RecordHistoryRequest defines the request body for creating history record
type RecordHistoryRequest struct {
	EntityType    string                 `json:"entity_type" binding:"required"`
	EntityID      string                 `json:"entity_id" binding:"required"`
	ProjectID     string                 `json:"project_id"`
	UserID        uint                   `json:"user_id"`
	Source        string                 `json:"source,omitempty"`
	SourceEventID string                 `json:"source_event_id,omitempty"`
	Action        string                 `json:"action" binding:"required"`
	Data          map[string]interface{} `json:"data" binding:"required"`
	Diff          map[string]interface{} `json:"diff,omitempty"`
	Message       string                 `json:"message"`
}

// HistoryResponse defines the response structure for a history record
type HistoryResponse struct {
	ID            string                 `json:"id"`
	EntityType    string                 `json:"entity_type"`
	EntityID      string                 `json:"entity_id"`
	ProjectID     string                 `json:"project_id"`
	UserID        uint                   `json:"user_id"`
	Source        string                 `json:"source,omitempty"`
	SourceEventID string                 `json:"source_event_id,omitempty"`
	Action        string                 `json:"action"`
	Data          map[string]interface{} `json:"data"`
	Diff          map[string]interface{} `json:"diff,omitempty"`
	Message       string                 `json:"message"`
	CreatedAt     time.Time              `json:"created_at"`
}

// RollbackRequest defines the request body for rolling back an entity
type RollbackRequest struct {
	VersionID string `json:"version_id" binding:"required"`
}

func toResponse(h *History) *HistoryResponse {
	if h == nil {
		return nil
	}
	return &HistoryResponse{
		ID:            h.ID,
		EntityType:    h.EntityType,
		EntityID:      h.EntityID,
		ProjectID:     h.ProjectID,
		UserID:        h.UserID,
		Source:        h.Source,
		SourceEventID: h.SourceEventID,
		Action:        h.Action,
		Data:          h.Data,
		Diff:          h.Diff,
		Message:       h.Message,
		CreatedAt:     h.CreatedAt,
	}
}

func toResponseSlice(histories []*History) []*HistoryResponse {
	result := make([]*HistoryResponse, len(histories))
	for i, h := range histories {
		result[i] = toResponse(h)
	}
	return result
}
