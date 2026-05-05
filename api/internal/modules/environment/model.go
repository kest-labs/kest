package environment

import (
	"time"

	"gorm.io/gorm"
)

// EnvironmentPO represents an environment in the database
type EnvironmentPO struct {
	ID          string         `gorm:"primaryKey" json:"id"`
	ProjectID   string         `gorm:"not null;index:idx_env_project" json:"project_id"`
	Name        string         `gorm:"size:50;not null" json:"name"`
	DisplayName string         `gorm:"size:100" json:"display_name"`
	BaseURL     string         `gorm:"size:500" json:"base_url"`
	Variables   string         `gorm:"type:text" json:"variables"` // JSON string
	Headers     string         `gorm:"type:text" json:"headers"`   // JSON string
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}

// TableName returns the table name for EnvironmentPO
func (EnvironmentPO) TableName() string {
	return "environments"
}
