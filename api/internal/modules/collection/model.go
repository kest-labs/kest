package collection

import (
	"encoding/json"
	"time"

	"gorm.io/gorm"
)

// CollectionPO is the persistent object for database operations
type CollectionPO struct {
	ID          uint           `gorm:"primaryKey"`
	Name        string         `gorm:"size:100;not null"`
	Description string         `gorm:"size:500"`
	ProjectID   uint           `gorm:"not null;index"`
	ParentID    *uint          `gorm:"index"` // For folder hierarchy
	IsFolder    bool           `gorm:"default:false"`
	SortOrder   int            `gorm:"default:0"`
	Settings    string         `gorm:"type:text"` // JSON settings as string
	CreatedAt   time.Time
	UpdatedAt   time.Time
	DeletedAt   gorm.DeletedAt `gorm:"index"`
}

// TableName specifies the database table name
func (CollectionPO) TableName() string {
	return "collections"
}

// Collection is the domain entity
type Collection struct {
	ID          uint                   `json:"id"`
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	ProjectID   uint                   `json:"project_id"`
	ParentID    *uint                  `json:"parent_id,omitempty"`
	IsFolder    bool                   `json:"is_folder"`
	SortOrder   int                    `json:"sort_order"`
	Settings    map[string]interface{} `json:"settings,omitempty"`
	CreatedAt   time.Time              `json:"created_at"`
	UpdatedAt   time.Time              `json:"updated_at"`
}

// toDomain converts CollectionPO to Collection domain entity
func (po *CollectionPO) toDomain() *Collection {
	if po == nil {
		return nil
	}

	var settings map[string]interface{}
	if po.Settings != "" {
		_ = json.Unmarshal([]byte(po.Settings), &settings)
	}

	return &Collection{
		ID:          po.ID,
		Name:        po.Name,
		Description: po.Description,
		ProjectID:   po.ProjectID,
		ParentID:    po.ParentID,
		IsFolder:    po.IsFolder,
		SortOrder:   po.SortOrder,
		Settings:    settings,
		CreatedAt:   po.CreatedAt,
		UpdatedAt:   po.UpdatedAt,
	}
}

// newCollectionPO converts Collection domain to CollectionPO for database operations
func newCollectionPO(c *Collection) *CollectionPO {
	if c == nil {
		return nil
	}

	var settingsStr string
	if c.Settings != nil {
		b, _ := json.Marshal(c.Settings)
		settingsStr = string(b)
	}

	return &CollectionPO{
		ID:          c.ID,
		Name:        c.Name,
		Description: c.Description,
		ProjectID:   c.ProjectID,
		ParentID:    c.ParentID,
		IsFolder:    c.IsFolder,
		SortOrder:   c.SortOrder,
		Settings:    settingsStr,
	}
}

// toDomainList converts a slice of CollectionPO to Collection slice
func toDomainList(poList []*CollectionPO) []*Collection {
	result := make([]*Collection, len(poList))
	for i, po := range poList {
		result[i] = po.toDomain()
	}
	return result
}
