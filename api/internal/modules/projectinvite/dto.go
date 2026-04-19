package projectinvite

import (
	"fmt"
	"net/url"
	"strings"
	"time"

	"github.com/kest-labs/kest/api/internal/infra/config"
)

type CreateProjectInvitationRequest struct {
	Role      string     `json:"role" binding:"required,oneof=admin write read"`
	ExpiresAt *time.Time `json:"expires_at"`
	MaxUses   *int       `json:"max_uses"`
}

type ProjectInvitationResponse struct {
	ID            uint       `json:"id"`
	ProjectID     uint       `json:"project_id"`
	TokenPrefix   string     `json:"token_prefix"`
	Slug          string     `json:"slug"`
	Role          string     `json:"role"`
	Status        string     `json:"status"`
	InviteURL     string     `json:"invite_url"`
	MaxUses       int        `json:"max_uses"`
	UsedCount     int        `json:"used_count"`
	RemainingUses *int       `json:"remaining_uses"`
	ExpiresAt     *time.Time `json:"expires_at,omitempty"`
	LastUsedAt    *time.Time `json:"last_used_at,omitempty"`
	CreatedBy     uint       `json:"created_by"`
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`
}

type PublicProjectInvitationResponse struct {
	ProjectID     uint       `json:"project_id"`
	ProjectName   string     `json:"project_name"`
	ProjectSlug   string     `json:"project_slug"`
	Role          string     `json:"role"`
	Status        string     `json:"status"`
	ExpiresAt     *time.Time `json:"expires_at,omitempty"`
	RemainingUses *int       `json:"remaining_uses"`
	RequiresAuth  bool       `json:"requires_auth"`
}

type AcceptedProjectInvitationMember struct {
	UserID uint   `json:"user_id"`
	Role   string `json:"role"`
}

type AcceptProjectInvitationResponse struct {
	ProjectID  uint                            `json:"project_id"`
	Member     AcceptedProjectInvitationMember `json:"member"`
	RedirectTo string                          `json:"redirect_to"`
}

type RejectProjectInvitationResponse struct {
	Status string `json:"status"`
}

func toProjectInvitationResponse(invitation *ProjectInvitation, now time.Time) *ProjectInvitationResponse {
	if invitation == nil {
		return nil
	}

	return &ProjectInvitationResponse{
		ID:            invitation.ID,
		ProjectID:     invitation.ProjectID,
		TokenPrefix:   invitation.TokenPrefix,
		Slug:          invitation.Slug,
		Role:          invitation.Role,
		Status:        resolveInvitationStatus(invitation, now),
		InviteURL:     buildProjectInvitationURL(invitation.Slug),
		MaxUses:       invitation.MaxUses,
		UsedCount:     invitation.UsedCount,
		RemainingUses: remainingInvitationUses(invitation),
		ExpiresAt:     invitation.ExpiresAt,
		LastUsedAt:    invitation.LastUsedAt,
		CreatedBy:     invitation.CreatedBy,
		CreatedAt:     invitation.CreatedAt,
		UpdatedAt:     invitation.UpdatedAt,
	}
}

func toPublicProjectInvitationResponse(
	invitation *ProjectInvitation,
	project *ProjectSummary,
	now time.Time,
) *PublicProjectInvitationResponse {
	if invitation == nil || project == nil {
		return nil
	}

	return &PublicProjectInvitationResponse{
		ProjectID:     project.ID,
		ProjectName:   project.Name,
		ProjectSlug:   project.Slug,
		Role:          invitation.Role,
		Status:        resolveInvitationStatus(invitation, now),
		ExpiresAt:     invitation.ExpiresAt,
		RemainingUses: remainingInvitationUses(invitation),
		RequiresAuth:  true,
	}
}

func buildProjectInvitationURL(slug string) string {
	path := fmt.Sprintf("/invite/project/%s", url.PathEscape(slug))
	if cfg := config.GlobalConfig; cfg != nil {
		base := strings.TrimRight(strings.TrimSpace(cfg.App.URL), "/")
		if base != "" {
			return base + path
		}
	}
	return path
}
