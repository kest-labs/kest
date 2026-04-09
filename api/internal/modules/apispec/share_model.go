package apispec

import "time"

// APISpecSharePO stores the published public snapshot for an API specification.
type APISpecSharePO struct {
	ID        uint   `gorm:"primaryKey"`
	ProjectID uint   `gorm:"index;not null"`
	APISpecID uint   `gorm:"not null;uniqueIndex"`
	Slug      string `gorm:"size:64;not null;uniqueIndex"`
	Snapshot  string `gorm:"type:text;not null"`
	CreatedBy uint   `gorm:"not null"`
	CreatedAt time.Time
	UpdatedAt time.Time
}

// TableName overrides the default table name.
func (APISpecSharePO) TableName() string {
	return "api_spec_shares"
}

// PublicAPISpecShareSnapshot is the safe public projection rendered on the anonymous share page.
type PublicAPISpecShareSnapshot struct {
	Method         string                  `json:"method"`
	Path           string                  `json:"path"`
	Summary        string                  `json:"summary"`
	Description    string                  `json:"description"`
	DocMarkdown    string                  `json:"doc_markdown,omitempty"`
	DocMarkdownZh  string                  `json:"doc_markdown_zh,omitempty"`
	DocMarkdownEn  string                  `json:"doc_markdown_en,omitempty"`
	DocSource      string                  `json:"doc_source,omitempty"`
	DocUpdatedAt   *time.Time              `json:"doc_updated_at,omitempty"`
	DocUpdatedAtZh *time.Time              `json:"doc_updated_at_zh,omitempty"`
	DocUpdatedAtEn *time.Time              `json:"doc_updated_at_en,omitempty"`
	Tags           []string                `json:"tags"`
	RequestBody    *RequestBodySpec        `json:"request_body,omitempty"`
	Parameters     []ParameterSpec         `json:"parameters,omitempty"`
	Responses      map[string]ResponseSpec `json:"responses,omitempty"`
	Version        string                  `json:"version"`
}
