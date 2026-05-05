package category

import (
	"time"

	"gorm.io/gorm"
)

// CategoryPO represents an API category in the database
type CategoryPO struct {
	ID          string         `gorm:"primaryKey" json:"id"`
	ProjectID   string         `gorm:"not null;index:idx_categories_project" json:"project_id"`
	Name        string         `gorm:"size:255;not null" json:"name"`
	ParentID    *string        `gorm:"index:idx_categories_parent" json:"parent_id"`
	Description string         `gorm:"type:text" json:"description"`
	SortOrder   int            `gorm:"default:0" json:"sort_order"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}

// TableName returns the table name for CategoryPO
func (CategoryPO) TableName() string {
	return "api_categories"
}
