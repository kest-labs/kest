package projectinvite

import (
	"fmt"
	"net/url"
	"time"
)

type CreateProjectInvitationRequest struct {
	Role          string     `json:"role" binding:"required,oneof=admin write read"`
	ExpiresAt     *time.Time `json:"expires_at"`
	MaxUses       *int       `json:"max_uses"`
	InvitedUserID string     `json:"invited_user_id,omitempty"`
}

type ProjectInvitationResponse struct {
	ID            string                 `json:"id"`
	ProjectID     string                 `json:"project_id"`
	TokenPrefix   string                 `json:"token_prefix"`
	Slug          string                 `json:"slug"`
	Role          string                 `json:"role"`
	Status        string                 `json:"status"`
	InviteURL     string                 `json:"invite_url"`
	InvitedUser   *ProjectInvitationUser `json:"invited_user,omitempty"`
	MaxUses       int                    `json:"max_uses"`
	UsedCount     int                    `json:"used_count"`
	RemainingUses *int                   `json:"remaining_uses"`
	ExpiresAt     *time.Time             `json:"expires_at,omitempty"`
	LastUsedAt    *time.Time             `json:"last_used_at,omitempty"`
	CreatedBy     string                 `json:"created_by"`
	CreatedAt     time.Time              `json:"created_at"`
	UpdatedAt     time.Time              `json:"updated_at"`
}

type PublicProjectInvitationResponse struct {
	ProjectID     string     `json:"project_id"`
	ProjectName   string     `json:"project_name"`
	ProjectSlug   string     `json:"project_slug"`
	Role          string     `json:"role"`
	Status        string     `json:"status"`
	ExpiresAt     *time.Time `json:"expires_at,omitempty"`
	RemainingUses *int       `json:"remaining_uses"`
	RequiresAuth  bool       `json:"requires_auth"`
}

type AcceptedProjectInvitationMember struct {
	UserID string `json:"user_id"`
	Role   string `json:"role"`
}

type AcceptProjectInvitationResponse struct {
	ProjectID  string                          `json:"project_id"`
	Member     AcceptedProjectInvitationMember `json:"member"`
	RedirectTo string                          `json:"redirect_to"`
}

type RejectProjectInvitationResponse struct {
	Status string `json:"status"`
}

type ReceivedProjectInvitationResponse struct {
	ID          string     `json:"id"`
	ProjectID   string     `json:"project_id"`
	ProjectName string     `json:"project_name"`
	ProjectSlug string     `json:"project_slug"`
	Slug        string     `json:"slug"`
	Role        string     `json:"role"`
	Status      string     `json:"status"`
	InviteURL   string     `json:"invite_url"`
	ExpiresAt   *time.Time `json:"expires_at,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
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
		InvitedUser:   invitation.InvitedUser,
		MaxUses:       invitation.MaxUses,
		UsedCount:     invitation.UsedCount,
		RemainingUses: remainingInvitationUses(invitation),
		ExpiresAt:     invitation.ExpiresAt,
		LastUsedAt:    invitation.LastUsedAt,
		CreatedBy:     invitation.CreatedBy,
		TargetUserID:  invitation.TargetUserID,
		CreatedAt:     invitation.CreatedAt,
		UpdatedAt:     invitation.UpdatedAt,
	}
}

func (r *ProjectInvitationResponse) withBaseURL(baseURL string) *ProjectInvitationResponse {
	if r == nil {
		return nil
	}

	r.InviteURL = buildProjectInvitationURLForBase(r.Slug, baseURL)
	return r
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

func toReceivedProjectInvitationResponse(
	invitation *ProjectInvitation,
	project *ProjectSummary,
	now time.Time,
) *ReceivedProjectInvitationResponse {
	if invitation == nil || project == nil {
		return nil
	}

	return &ReceivedProjectInvitationResponse{
		ID:          invitation.ID,
		ProjectID:   project.ID,
		ProjectName: project.Name,
		ProjectSlug: project.Slug,
		Slug:        invitation.Slug,
		Role:        invitation.Role,
		Status:      resolveInvitationStatus(invitation, now),
		InviteURL:   buildProjectInvitationURL(invitation.Slug),
		ExpiresAt:   invitation.ExpiresAt,
		CreatedAt:   invitation.CreatedAt,
		UpdatedAt:   invitation.UpdatedAt,
	}
}

func buildProjectInvitationURL(slug string) string {
	return buildProjectInvitationURLForBase(slug, "")
}

func buildProjectInvitationURLForBase(slug, baseURL string) string {
	path := fmt.Sprintf("/invite/project/%s", url.PathEscape(slug))
	base := resolveConfiguredInvitationBaseURL()
	if base != "" {
		return base + path
	}
	base = normalizeInvitationBaseURL(baseURL, false)
	if base != "" {
		return base + path
	}
	return path
}
