package workspaceinvite

import (
	"time"

	"gorm.io/gorm"
)

const (
	InvitationStatusActive   = "active"
	InvitationStatusRejected = "rejected"
	InvitationStatusRevoked  = "revoked"
	InvitationStatusExpired  = "expired"
	InvitationStatusUsedUp   = "used_up"
)

const defaultInvitationValidity = 7 * 24 * time.Hour

// WorkspaceInvitationPO stores shareable workspace invitation links.
type WorkspaceInvitationPO struct {
	ID            string `gorm:"primaryKey"`
	CreatedAt     time.Time
	UpdatedAt     time.Time
	DeletedAt     gorm.DeletedAt             `gorm:"index"`
	WorkspaceID   string                     `gorm:"not null;index"`
	TokenHash     string                     `gorm:"size:64;not null;uniqueIndex"`
	TokenPrefix   string                     `gorm:"size:32;not null;index"`
	Slug          string                     `gorm:"size:64;not null;uniqueIndex"`
	Role          string                     `gorm:"size:20;not null"`
	CreatedBy     string                     `gorm:"not null;index"`
	InvitedUserID *string                    `gorm:"index"`
	InvitedUser   *WorkspaceInvitationUserPO `gorm:"foreignKey:InvitedUserID;references:ID"`
	Status        string                     `gorm:"size:20;not null;index"`
	MaxUses       int                        `gorm:"not null;default:1"`
	UsedCount     int                        `gorm:"not null;default:0"`
	ExpiresAt     *time.Time
	LastUsedAt    *time.Time
}

func (WorkspaceInvitationPO) TableName() string {
	return "workspace_invitations"
}

// WorkspaceInvitation is the service-layer invitation entity.
type WorkspaceInvitation struct {
	ID            string                   `json:"id"`
	WorkspaceID   string                   `json:"workspace_id"`
	TokenPrefix   string                   `json:"token_prefix"`
	Slug          string                   `json:"slug"`
	Role          string                   `json:"role"`
	CreatedBy     string                   `json:"created_by"`
	InvitedUserID *string                  `json:"invited_user_id,omitempty"`
	InvitedUser   *WorkspaceInvitationUser `json:"invited_user,omitempty"`
	Status        string                   `json:"status"`
	MaxUses       int                      `json:"max_uses"`
	UsedCount     int                      `json:"used_count"`
	ExpiresAt     *time.Time               `json:"expires_at,omitempty"`
	LastUsedAt    *time.Time               `json:"last_used_at,omitempty"`
	CreatedAt     time.Time                `json:"created_at"`
	UpdatedAt     time.Time                `json:"updated_at"`
}

// WorkspaceSummary is a lightweight workspace description used by public invite pages.
type WorkspaceSummary struct {
	ID   string
	Name string
	Slug string
}

type WorkspaceInvitationUserPO struct {
	ID       string `gorm:"primaryKey"`
	Username string `gorm:"column:username"`
	Email    string `gorm:"column:email"`
}

func (WorkspaceInvitationUserPO) TableName() string {
	return "users"
}

type WorkspaceInvitationUser struct {
	ID       string `json:"id"`
	Username string `json:"username"`
	Email    string `json:"email"`
}

func (po *WorkspaceInvitationPO) toDomain() *WorkspaceInvitation {
	if po == nil {
		return nil
	}

	return &WorkspaceInvitation{
		ID:            po.ID,
		WorkspaceID:   po.WorkspaceID,
		TokenPrefix:   po.TokenPrefix,
		Slug:          po.Slug,
		Role:          po.Role,
		CreatedBy:     po.CreatedBy,
		InvitedUserID: po.InvitedUserID,
		InvitedUser:   po.InvitedUser.toDomain(),
		Status:        po.Status,
		MaxUses:       po.MaxUses,
		UsedCount:     po.UsedCount,
		ExpiresAt:     po.ExpiresAt,
		LastUsedAt:    po.LastUsedAt,
		CreatedAt:     po.CreatedAt,
		UpdatedAt:     po.UpdatedAt,
	}
}

func newWorkspaceInvitationPO(invitation *WorkspaceInvitation, tokenHash string) *WorkspaceInvitationPO {
	if invitation == nil {
		return nil
	}

	return &WorkspaceInvitationPO{
		ID:            invitation.ID,
		WorkspaceID:   invitation.WorkspaceID,
		TokenHash:     tokenHash,
		TokenPrefix:   invitation.TokenPrefix,
		Slug:          invitation.Slug,
		Role:          invitation.Role,
		CreatedBy:     invitation.CreatedBy,
		InvitedUserID: invitation.InvitedUserID,
		Status:        invitation.Status,
		MaxUses:       invitation.MaxUses,
		UsedCount:     invitation.UsedCount,
		ExpiresAt:     invitation.ExpiresAt,
		LastUsedAt:    invitation.LastUsedAt,
	}
}

func (po *WorkspaceInvitationUserPO) toDomain() *WorkspaceInvitationUser {
	if po == nil {
		return nil
	}

	return &WorkspaceInvitationUser{
		ID:       po.ID,
		Username: po.Username,
		Email:    po.Email,
	}
}

func resolveInvitationStatus(invitation *WorkspaceInvitation, now time.Time) string {
	if invitation == nil {
		return InvitationStatusExpired
	}

	if invitation.Status == InvitationStatusRejected {
		return InvitationStatusRejected
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

func remainingInvitationUses(invitation *WorkspaceInvitation) *int {
	if invitation == nil || invitation.MaxUses == 0 {
		return nil
	}

	remaining := invitation.MaxUses - invitation.UsedCount
	if remaining < 0 {
		remaining = 0
	}
	return &remaining
}
