package migrations

import (
	"time"

	"gorm.io/gorm"
)

type legacyProjectPO struct {
	ID          string `gorm:"primaryKey"`
	CreatedAt   time.Time
	UpdatedAt   time.Time
	DeletedAt   gorm.DeletedAt `gorm:"index"`
	WorkspaceID string         `gorm:"index"`
	Name        string         `gorm:"size:100;not null"`
	Slug        string         `gorm:"size:50;uniqueIndex"`
	Platform    string         `gorm:"size:50"`
	PublicKey   string         `gorm:"size:64"`
	Status      int            `gorm:"default:1"`
}

func (legacyProjectPO) TableName() string {
	return "projects"
}

type legacyProjectMemberPO struct {
	ID        string `gorm:"primaryKey"`
	ProjectID string `gorm:"index;uniqueIndex:idx_project_user;not null"`
	UserID    string `gorm:"index;uniqueIndex:idx_project_user;not null"`
	Role      string `gorm:"size:20;not null"`
	CreatedAt time.Time
	UpdatedAt time.Time
	DeletedAt gorm.DeletedAt `gorm:"index"`
}

func (legacyProjectMemberPO) TableName() string {
	return "project_members"
}

type legacyProjectInvitationPO struct {
	ID            string `gorm:"primaryKey"`
	CreatedAt     time.Time
	UpdatedAt     time.Time
	DeletedAt     gorm.DeletedAt `gorm:"index"`
	ProjectID     string         `gorm:"not null;index"`
	TokenHash     string         `gorm:"size:64;not null;uniqueIndex"`
	TokenPrefix   string         `gorm:"size:32;not null;index"`
	Slug          string         `gorm:"size:64;not null;uniqueIndex"`
	Role          string         `gorm:"size:20;not null"`
	CreatedBy     string         `gorm:"not null;index"`
	InvitedUserID *string        `gorm:"index"`
	Status        string         `gorm:"size:20;not null;index"`
	MaxUses       int            `gorm:"not null;default:1"`
	UsedCount     int            `gorm:"not null;default:0"`
	ExpiresAt     *time.Time
	LastUsedAt    *time.Time
}

func (legacyProjectInvitationPO) TableName() string {
	return "project_invitations"
}
