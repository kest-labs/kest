package apispec

import (
	"time"

	"gorm.io/gorm"
)

// APISpecPO is the persistent object for API specifications
type APISpecPO struct {
	ID             uint   `gorm:"primaryKey"`
	ProjectID      uint   `gorm:"index;not null"`          // Foreign key to projects table
	CategoryID     *uint  `gorm:"index"`                   // Optional category
	Method         string `gorm:"size:10;not null;index"`  // GET, POST, etc.
	Path           string `gorm:"size:500;not null;index"` // /api/users/:id
	Summary        string `gorm:"size:500"`                // Short description
	Description    string `gorm:"type:text"`               // Detailed description
	DocMarkdown    string `gorm:"type:text"`               // Frontend-facing API doc content (Markdown)
	DocMarkdownZh  string `gorm:"type:text"`               // Chinese API doc content (Markdown)
	DocMarkdownEn  string `gorm:"type:text"`               // English API doc content (Markdown)
	DocSource      string `gorm:"size:20;default:manual"`  // manual | ai
	DocUpdatedAt   *time.Time
	DocUpdatedAtZh *time.Time
	DocUpdatedAtEn *time.Time
	TestContent    string `gorm:"type:text"`              // Generated Kest flow test content (.flow.md)
	TestSource     string `gorm:"size:20;default:manual"` // manual | ai
	TestUpdatedAt  *time.Time
	Tags           string `gorm:"size:500"`      // Comma-separated tags
	RequestBody    string `gorm:"type:text"`     // JSON schema
	Parameters     string `gorm:"type:text"`     // JSON array of parameters
	Responses      string `gorm:"type:text"`     // JSON map of responses
	Examples       string `gorm:"type:text"`     // JSON array of examples
	Version        string `gorm:"size:50;index"` // API version
	IsPublic       bool   `gorm:"default:true"`  // Public or private
	CreatedAt      time.Time
	UpdatedAt      time.Time
	DeletedAt      gorm.DeletedAt `gorm:"index"`
}

// TableName overrides the default table name
func (APISpecPO) TableName() string {
	return "api_specs"
}

// APIExamplePO is the persistent object for API request/response examples
type APIExamplePO struct {
	ID              uint   `gorm:"primaryKey"`
	APISpecID       uint   `gorm:"index;not null"`    // Foreign key to api_specs
	Name            string `gorm:"size:255;not null"` // Example name
	Description     string `gorm:"type:text"`         // Example description
	Path            string `gorm:"size:500"`          // Request path
	Method          string `gorm:"size:10"`           // HTTP method
	RequestHeaders  string `gorm:"type:text"`         // JSON map
	RequestBody     string `gorm:"type:text"`         // JSON
	ResponseStatus  int    `gorm:"not null"`          // HTTP status code
	ResponseBody    string `gorm:"type:text"`         // JSON
	ResponseHeaders string `gorm:"type:text"`         // JSON map
	DurationMs      int64  `gorm:"default:0"`         // Response time
	CreatedAt       time.Time
	UpdatedAt       time.Time
	DeletedAt       gorm.DeletedAt `gorm:"index"`
}

// TableName overrides the default table name
func (APIExamplePO) TableName() string {
	return "api_examples"
}
