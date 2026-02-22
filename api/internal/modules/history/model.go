package history

import (
	"encoding/json"
	"time"

	"gorm.io/gorm"
)

// HistoryPO is the database model for version history
type HistoryPO struct {
	ID           uint           `gorm:"primaryKey" json:"id"`
	EntityType   string         `gorm:"size:50;not null;index" json:"entity_type"` // e.g., "collection", "request"
	EntityID     uint           `gorm:"not null;index" json:"entity_id"`
	ProjectID    uint           `gorm:"not null;index" json:"project_id"`
	UserID       uint           `gorm:"not null" json:"user_id"` // who made the change
	Action       string         `gorm:"size:20;not null" json:"action"` // "create", "update", "delete", "move"
	Data         string         `gorm:"type:text" json:"data"`          // JSON snapshot of the entity at this version
	Diff         string         `gorm:"type:text" json:"diff"`          // JSON describing what changed (optional)
	Message      string         `gorm:"size:255" json:"message"`        // Optional commit message
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`
}

func (HistoryPO) TableName() string {
	return "history"
}

// History represents the domain model
type History struct {
	ID         uint                   `json:"id"`
	EntityType string                 `json:"entity_type"`
	EntityID   uint                   `json:"entity_id"`
	ProjectID  uint                   `json:"project_id"`
	UserID     uint                   `json:"user_id"`
	Action     string                 `json:"action"`
	Data       map[string]interface{} `json:"data"`
	Diff       map[string]interface{} `json:"diff,omitempty"`
	Message    string                 `json:"message"`
	CreatedAt  time.Time              `json:"created_at"`
}

func (po *HistoryPO) toDomain() *History {
	if po == nil {
		return nil
	}

	var data map[string]interface{}
	_ = json.Unmarshal([]byte(po.Data), &data)

	var diff map[string]interface{}
	if po.Diff != "" {
		_ = json.Unmarshal([]byte(po.Diff), &diff)
	}

	return &History{
		ID:         po.ID,
		EntityType: po.EntityType,
		EntityID:   po.EntityID,
		ProjectID:  po.ProjectID,
		UserID:     po.UserID,
		Action:     po.Action,
		Data:       data,
		Diff:       diff,
		Message:    po.Message,
		CreatedAt:  po.CreatedAt,
	}
}

func newHistoryPO(h *History) *HistoryPO {
	if h == nil {
		return nil
	}

	dataStr := ""
	if h.Data != nil {
		b, _ := json.Marshal(h.Data)
		dataStr = string(b)
	}

	diffStr := ""
	if h.Diff != nil {
		b, _ := json.Marshal(h.Diff)
		diffStr = string(b)
	}

	return &HistoryPO{
		ID:         h.ID,
		EntityType: h.EntityType,
		EntityID:   h.EntityID,
		ProjectID:  h.ProjectID,
		UserID:     h.UserID,
		Action:     h.Action,
		Data:       dataStr,
		Diff:       diffStr,
		Message:    h.Message,
	}
}

func toDomainList(poList []*HistoryPO) []*History {
	result := make([]*History, len(poList))
	for i, po := range poList {
		result[i] = po.toDomain()
	}
	return result
}
