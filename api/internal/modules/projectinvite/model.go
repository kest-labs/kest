package projectinvite

import (
	"time"

	"gorm.io/gorm"
)

const (
	InvitationStatusActive  = "active"
	InvitationStatusRevoked = "revoked"
	InvitationStatusExpired = "expired"
	InvitationStatusUsedUp  = "used_up"
)

const defaultInvitationValidity = 7 * 24 * time.Hour

// ProjectInvitationPO stores shareable project invitation links.
type ProjectInvitationPO struct {
	ID          uint `gorm:"primaryKey"`
	CreatedAt   time.Time
	UpdatedAt   time.Time
	DeletedAt   gorm.DeletedAt `gorm:"index"`
	ProjectID   uint           `gorm:"not null;index"`
	TokenHash   string         `gorm:"size:64;not null;uniqueIndex"`
	TokenPrefix string         `gorm:"size:32;not null;index"`
	Slug        string         `gorm:"size:64;not null;uniqueIndex"`
	Role        string         `gorm:"size:20;not null"`
	CreatedBy   uint           `gorm:"not null;index"`
	Status      string         `gorm:"size:20;not null;index"`
	MaxUses     int            `gorm:"not null;default:1"`
	UsedCount   int            `gorm:"not null;default:0"`
	ExpiresAt   *time.Time
	LastUsedAt  *time.Time
}

func (ProjectInvitationPO) TableName() string {
	return "project_invitations"
}

// ProjectInvitation is the service-layer invitation entity.
type ProjectInvitation struct {
	ID          uint       `json:"id"`
	ProjectID   uint       `json:"project_id"`
	TokenPrefix string     `json:"token_prefix"`
	Slug        string     `json:"slug"`
	Role        string     `json:"role"`
	CreatedBy   uint       `json:"created_by"`
	Status      string     `json:"status"`
	MaxUses     int        `json:"max_uses"`
	UsedCount   int        `json:"used_count"`
	ExpiresAt   *time.Time `json:"expires_at,omitempty"`
	LastUsedAt  *time.Time `json:"last_used_at,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}

// ProjectSummary is a lightweight project projection used by public invite pages.
type ProjectSummary struct {
	ID   uint
	Name string
	Slug string
}

func (po *ProjectInvitationPO) toDomain() *ProjectInvitation {
	if po == nil {
		return nil
	}

	return &ProjectInvitation{
		ID:          po.ID,
		ProjectID:   po.ProjectID,
		TokenPrefix: po.TokenPrefix,
		Slug:        po.Slug,
		Role:        po.Role,
		CreatedBy:   po.CreatedBy,
		Status:      po.Status,
		MaxUses:     po.MaxUses,
		UsedCount:   po.UsedCount,
		ExpiresAt:   po.ExpiresAt,
		LastUsedAt:  po.LastUsedAt,
		CreatedAt:   po.CreatedAt,
		UpdatedAt:   po.UpdatedAt,
	}
}

func newProjectInvitationPO(invitation *ProjectInvitation, tokenHash string) *ProjectInvitationPO {
	if invitation == nil {
		return nil
	}

	return &ProjectInvitationPO{
		ID:          invitation.ID,
		ProjectID:   invitation.ProjectID,
		TokenHash:   tokenHash,
		TokenPrefix: invitation.TokenPrefix,
		Slug:        invitation.Slug,
		Role:        invitation.Role,
		CreatedBy:   invitation.CreatedBy,
		Status:      invitation.Status,
		MaxUses:     invitation.MaxUses,
		UsedCount:   invitation.UsedCount,
		ExpiresAt:   invitation.ExpiresAt,
		LastUsedAt:  invitation.LastUsedAt,
	}
}

func resolveInvitationStatus(invitation *ProjectInvitation, now time.Time) string {
	if invitation == nil {
		return InvitationStatusExpired
	}

	if invitation.Status == InvitationStatusRevoked {
		return InvitationStatusRevoked
	}
	if invitation.Status == InvitationStatusExpired {
		return InvitationStatusExpired
	}
	if invitation.ExpiresAt != nil && !invitation.ExpiresAt.After(now) {
		return InvitationStatusExpired
	}
	if invitation.MaxUses > 0 && invitation.UsedCount >= invitation.MaxUses {
		return InvitationStatusUsedUp
	}
	return InvitationStatusActive
}

func remainingInvitationUses(invitation *ProjectInvitation) *int {
	if invitation == nil || invitation.MaxUses == 0 {
		return nil
	}

	remaining := invitation.MaxUses - invitation.UsedCount
	if remaining < 0 {
		remaining = 0
	}
	return &remaining
}
