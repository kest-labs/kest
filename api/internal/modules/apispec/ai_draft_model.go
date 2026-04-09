package apispec

import (
	"time"

	"gorm.io/gorm"
)

const (
	AIDraftStatusDraft     = "draft"
	AIDraftStatusAccepted  = "accepted"
	AIDraftStatusDiscarded = "discarded"
)

// APISpecAIDraftPO stores an AI-generated draft before it becomes a formal API spec.
type APISpecAIDraftPO struct {
	ID             uint   `gorm:"primaryKey"`
	ProjectID      uint   `gorm:"index;not null"`
	CreatedBy      uint   `gorm:"index;not null"`
	AcceptedSpecID *uint  `gorm:"index"`
	Status         string `gorm:"size:20;not null;default:draft"`
	Intent         string `gorm:"type:text;not null"`
	SeedInput      string `gorm:"type:text"`
	Draft          string `gorm:"type:text;not null"`
	References     string `gorm:"type:text"`
	Assumptions    string `gorm:"type:text"`
	Questions      string `gorm:"type:text"`
	FieldInsights  string `gorm:"type:text"`
	Conventions    string `gorm:"type:text"`
	CreatedAt      time.Time
	UpdatedAt      time.Time
	DeletedAt      gorm.DeletedAt `gorm:"index"`
}

func (APISpecAIDraftPO) TableName() string {
	return "api_spec_ai_drafts"
}
