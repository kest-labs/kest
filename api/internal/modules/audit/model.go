package audit

import (
	"time"

	"gorm.io/gorm"
)

// AuditLogPO persists audit events to the database
type AuditLogPO struct {
	ID          string         `gorm:"primaryKey"`
	UserID      string         `gorm:"index;not null"`
	WorkspaceID string         `gorm:"index;default:0"`        // 0 means global/non-workspace action
	Action      string         `gorm:"size:50;not null;index"` // e.g., "create", "update", "delete"
	Resource    string         `gorm:"size:50;not null;index"` // e.g., "workspace", "user"
	Method      string         `gorm:"size:10;not null"`       // e.g., "POST", "PATCH"
	Path        string         `gorm:"size:255;not null"`
	IP          string         `gorm:"size:50"`
	UserAgent   string         `gorm:"size:255"`
	Status      int            `gorm:"default:200"`
	Duration    int64          `gorm:"comment:Duration in milliseconds"`
	CreatedAt   time.Time      `gorm:"index"`
	DeletedAt   gorm.DeletedAt `gorm:"index"`
}

// AuditLogResponse is the API response for an audit log entry
type AuditLogResponse struct {
	ID          string    `json:"id"`
	UserID      string    `json:"user_id"`
	WorkspaceID string    `json:"workspace_id,omitempty"`
	Action      string    `json:"action"`
	Resource    string    `json:"resource"`
	Method      string    `json:"method"`
	Path        string    `json:"path"`
	IP          string    `json:"ip,omitempty"`
	Status      int       `json:"status"`
	Duration    int64     `json:"duration_ms"`
	CreatedAt   time.Time `json:"created_at"`
}

// ToResponse converts AuditLogPO to AuditLogResponse
func (a *AuditLogPO) ToResponse() *AuditLogResponse {
	return &AuditLogResponse{
		ID:          a.ID,
		UserID:      a.UserID,
		WorkspaceID: a.WorkspaceID,
		Action:      a.Action,
		Resource:    a.Resource,
		Method:      a.Method,
		Path:        a.Path,
		IP:          a.IP,
		Status:      a.Status,
		Duration:    a.Duration,
		CreatedAt:   a.CreatedAt,
	}
}

// TableName overrides the default table name
func (AuditLogPO) TableName() string {
	return "audit_logs"
}
