package workspaceinvite

import (
	"fmt"
	"net/url"
	"time"
)

type CreateWorkspaceInvitationRequest struct {
	Role          string     `json:"role" binding:"required,oneof=admin write read"`
	ExpiresAt     *time.Time `json:"expires_at"`
	MaxUses       *int       `json:"max_uses"`
	InvitedUserID string     `json:"invited_user_id,omitempty"`
}

type WorkspaceInvitationResponse struct {
	ID            string                   `json:"id"`
	WorkspaceID   string                   `json:"workspace_id"`
	TokenPrefix   string                   `json:"token_prefix"`
	Slug          string                   `json:"slug"`
	Role          string                   `json:"role"`
	Status        string                   `json:"status"`
	InviteURL     string                   `json:"invite_url"`
	InvitedUser   *WorkspaceInvitationUser `json:"invited_user,omitempty"`
	MaxUses       int                      `json:"max_uses"`
	UsedCount     int                      `json:"used_count"`
	RemainingUses *int                     `json:"remaining_uses"`
	ExpiresAt     *time.Time               `json:"expires_at,omitempty"`
	LastUsedAt    *time.Time               `json:"last_used_at,omitempty"`
	CreatedBy     string                   `json:"created_by"`
	CreatedAt     time.Time                `json:"created_at"`
	UpdatedAt     time.Time                `json:"updated_at"`
}

type PublicWorkspaceInvitationResponse struct {
	WorkspaceID   string     `json:"workspace_id"`
	WorkspaceName string     `json:"workspace_name"`
	WorkspaceSlug string     `json:"workspace_slug"`
	Role          string     `json:"role"`
	Status        string     `json:"status"`
	ExpiresAt     *time.Time `json:"expires_at,omitempty"`
	RemainingUses *int       `json:"remaining_uses"`
	RequiresAuth  bool       `json:"requires_auth"`
}

type AcceptedWorkspaceInvitationMember struct {
	UserID string `json:"user_id"`
	Role   string `json:"role"`
}

type AcceptWorkspaceInvitationResponse struct {
	WorkspaceID string                            `json:"workspace_id"`
	Member      AcceptedWorkspaceInvitationMember `json:"member"`
	RedirectTo  string                            `json:"redirect_to"`
}

type RejectWorkspaceInvitationResponse struct {
	Status string `json:"status"`
}

type ReceivedWorkspaceInvitationResponse struct {
	ID            string     `json:"id"`
	WorkspaceID   string     `json:"workspace_id"`
	WorkspaceName string     `json:"workspace_name"`
	WorkspaceSlug string     `json:"workspace_slug"`
	Slug          string     `json:"slug"`
	Role          string     `json:"role"`
	Status        string     `json:"status"`
	InviteURL     string     `json:"invite_url"`
	ExpiresAt     *time.Time `json:"expires_at,omitempty"`
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`
}

func toWorkspaceInvitationResponse(invitation *WorkspaceInvitation, now time.Time) *WorkspaceInvitationResponse {
	if invitation == nil {
		return nil
	}

	return &WorkspaceInvitationResponse{
		ID:            invitation.ID,
		WorkspaceID:   invitation.WorkspaceID,
		TokenPrefix:   invitation.TokenPrefix,
		Slug:          invitation.Slug,
		Role:          invitation.Role,
		Status:        resolveInvitationStatus(invitation, now),
		InviteURL:     buildWorkspaceInvitationURL(invitation.Slug),
		InvitedUser:   invitation.InvitedUser,
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

func (r *WorkspaceInvitationResponse) withBaseURL(baseURL string) *WorkspaceInvitationResponse {
	if r == nil {
		return nil
	}

	r.InviteURL = buildWorkspaceInvitationURLForBase(r.Slug, baseURL)
	return r
}

func toPublicWorkspaceInvitationResponse(
	invitation *WorkspaceInvitation,
	workspace *WorkspaceSummary,
	now time.Time,
) *PublicWorkspaceInvitationResponse {
	if invitation == nil || workspace == nil {
		return nil
	}

	return &PublicWorkspaceInvitationResponse{
		WorkspaceID:   workspace.ID,
		WorkspaceName: workspace.Name,
		WorkspaceSlug: workspace.Slug,
		Role:          invitation.Role,
		Status:        resolveInvitationStatus(invitation, now),
		ExpiresAt:     invitation.ExpiresAt,
		RemainingUses: remainingInvitationUses(invitation),
		RequiresAuth:  true,
	}
}

func toReceivedWorkspaceInvitationResponse(
	invitation *WorkspaceInvitation,
	workspace *WorkspaceSummary,
	now time.Time,
) *ReceivedWorkspaceInvitationResponse {
	if invitation == nil || workspace == nil {
		return nil
	}

	return &ReceivedWorkspaceInvitationResponse{
		ID:            invitation.ID,
		WorkspaceID:   workspace.ID,
		WorkspaceName: workspace.Name,
		WorkspaceSlug: workspace.Slug,
		Slug:          invitation.Slug,
		Role:          invitation.Role,
		Status:        resolveInvitationStatus(invitation, now),
		InviteURL:     buildWorkspaceInvitationURL(invitation.Slug),
		ExpiresAt:     invitation.ExpiresAt,
		CreatedAt:     invitation.CreatedAt,
		UpdatedAt:     invitation.UpdatedAt,
	}
}

func buildWorkspaceInvitationURL(slug string) string {
	return buildWorkspaceInvitationURLForBase(slug, "")
}

func buildWorkspaceInvitationURLForBase(slug, baseURL string) string {
	path := fmt.Sprintf("/invite/workspace/%s", url.PathEscape(slug))
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
