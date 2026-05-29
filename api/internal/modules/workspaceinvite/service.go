package workspaceinvite

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/kest-labs/kest/api/internal/modules/member"
)

var (
	ErrWorkspaceInvitationNotFound      = errors.New("workspace invitation not found")
	ErrWorkspaceInvitationInvalidRole   = errors.New("invalid workspace invitation role")
	ErrWorkspaceInvitationInvalidUses   = errors.New("max_uses must be greater than or equal to 0")
	ErrWorkspaceInvitationInvalidExpiry = errors.New("expires_at must be in the future")
	ErrWorkspaceInvitationExpired       = errors.New("workspace invitation has expired")
	ErrWorkspaceInvitationRejected      = errors.New("workspace invitation has been rejected")
	ErrWorkspaceInvitationRevoked       = errors.New("workspace invitation has been revoked")
	ErrWorkspaceInvitationUsedUp        = errors.New("workspace invitation has no remaining uses")
	ErrWorkspaceInvitationAlreadyMember = errors.New("user is already a member of this workspace")
	ErrWorkspaceInvitationNotRecipient  = errors.New("workspace invitation is not assigned to this user")
)

type Service interface {
	CreateInvitation(
		ctx context.Context,
		workspaceID string,
		createdBy string,
		req *CreateWorkspaceInvitationRequest,
	) (*WorkspaceInvitationResponse, error)
	ListInvitations(ctx context.Context, workspaceID string) ([]*WorkspaceInvitationResponse, error)
	ListReceivedInvitations(
		ctx context.Context,
		userID string,
	) ([]*ReceivedWorkspaceInvitationResponse, error)
	RevokeInvitation(ctx context.Context, workspaceID, invitationID string) error
	GetInvitationDetail(
		ctx context.Context,
		slug string,
	) (*PublicWorkspaceInvitationResponse, error)
	AcceptInvitation(
		ctx context.Context,
		slug string,
		userID string,
	) (*AcceptWorkspaceInvitationResponse, error)
	RejectInvitation(
		ctx context.Context,
		slug string,
		userID string,
	) (*RejectWorkspaceInvitationResponse, error)
}

type service struct {
	repo Repository
}

func NewService(repo Repository) Service {
	return &service{repo: repo}
}

func (s *service) CreateInvitation(
	ctx context.Context,
	workspaceID string,
	createdBy string,
	req *CreateWorkspaceInvitationRequest,
) (*WorkspaceInvitationResponse, error) {
	if req == nil {
		req = &CreateWorkspaceInvitationRequest{}
	}

	role := strings.TrimSpace(req.Role)
	if !isInvitationRoleAllowed(role) {
		return nil, ErrWorkspaceInvitationInvalidRole
	}

	invitedUserID := strings.TrimSpace(req.InvitedUserID)
	now := time.Now().UTC()
	maxUses := 1
	if req.MaxUses != nil {
		maxUses = *req.MaxUses
	}
	if maxUses < 0 {
		return nil, ErrWorkspaceInvitationInvalidUses
	}

	expiresAt, err := normalizeInvitationExpiry(req.ExpiresAt, now)
	if err != nil {
		return nil, err
	}

	if invitedUserID != "" {
		isMember, err := s.repo.HasWorkspaceMember(ctx, workspaceID, invitedUserID)
		if err != nil {
			return nil, err
		}
		if isMember {
			return nil, ErrWorkspaceInvitationAlreadyMember
		}

		// Direct invitations are one-to-one and always single-use. Replace any
		// previously pending direct invite so the recipient sees a single action.
		maxUses = 1
		if err := s.repo.RevokeActiveInvitationsForUser(ctx, workspaceID, invitedUserID); err != nil {
			return nil, err
		}
	}

	rawToken, tokenPrefix, tokenHash, err := generateInvitationTokenMaterial()
	if err != nil {
		return nil, fmt.Errorf("failed to generate invitation token: %w", err)
	}

	var invitedUserIDPtr *string
	if invitedUserID != "" {
		invitedUserIDPtr = &invitedUserID
	}

	invitation := &WorkspaceInvitation{
		WorkspaceID:   workspaceID,
		TokenPrefix:   tokenPrefix,
		Slug:          rawToken,
		Role:          role,
		CreatedBy:     createdBy,
		InvitedUserID: invitedUserIDPtr,
		Status:        InvitationStatusActive,
		MaxUses:       maxUses,
		ExpiresAt:     expiresAt,
	}

	if err := s.repo.CreateInvitation(ctx, invitation, tokenHash); err != nil {
		return nil, err
	}

	return toWorkspaceInvitationResponse(invitation, now), nil
}

func (s *service) ListInvitations(
	ctx context.Context,
	workspaceID string,
) ([]*WorkspaceInvitationResponse, error) {
	invitations, err := s.repo.ListInvitationsByWorkspace(ctx, workspaceID)
	if err != nil {
		return nil, err
	}

	now := time.Now().UTC()
	result := make([]*WorkspaceInvitationResponse, 0, len(invitations))
	for _, invitation := range invitations {
		result = append(result, toWorkspaceInvitationResponse(invitation, now))
	}
	return result, nil
}

func (s *service) ListReceivedInvitations(
	ctx context.Context,
	userID string,
) ([]*ReceivedWorkspaceInvitationResponse, error) {
	invitations, err := s.repo.ListInvitationsByInvitedUser(ctx, strings.TrimSpace(userID))
	if err != nil {
		return nil, err
	}

	now := time.Now().UTC()
	result := make([]*ReceivedWorkspaceInvitationResponse, 0, len(invitations))
	for _, invitation := range invitations {
		if resolveInvitationStatus(invitation, now) != InvitationStatusActive {
			continue
		}

		workspaceSummary, err := s.repo.GetWorkspaceSummary(ctx, invitation.WorkspaceID)
		if err != nil {
			return nil, err
		}
		if workspaceSummary == nil {
			continue
		}

		result = append(result, toReceivedWorkspaceInvitationResponse(invitation, workspaceSummary, now))
	}

	return result, nil
}

func (s *service) RevokeInvitation(ctx context.Context, workspaceID, invitationID string) error {
	invitation, err := s.repo.GetInvitationByWorkspace(ctx, workspaceID, invitationID)
	if err != nil {
		return err
	}
	if invitation == nil {
		return ErrWorkspaceInvitationNotFound
	}
	if invitation.Status == InvitationStatusRevoked {
		return nil
	}

	invitation.Status = InvitationStatusRevoked
	return s.repo.UpdateInvitation(ctx, invitation)
}

func (s *service) GetInvitationDetail(
	ctx context.Context,
	slug string,
) (*PublicWorkspaceInvitationResponse, error) {
	slug = strings.TrimSpace(slug)
	if slug == "" {
		return nil, ErrWorkspaceInvitationNotFound
	}

	invitation, err := s.repo.GetInvitationBySlug(ctx, slug)
	if err != nil {
		return nil, err
	}
	if invitation == nil {
		return nil, ErrWorkspaceInvitationNotFound
	}

	workspaceSummary, err := s.repo.GetWorkspaceSummary(ctx, invitation.WorkspaceID)
	if err != nil {
		return nil, err
	}
	if workspaceSummary == nil {
		return nil, ErrWorkspaceInvitationNotFound
	}

	return toPublicWorkspaceInvitationResponse(invitation, workspaceSummary, time.Now().UTC()), nil
}

func (s *service) AcceptInvitation(
	ctx context.Context,
	slug string,
	userID string,
) (*AcceptWorkspaceInvitationResponse, error) {
	invitation, err := s.repo.GetInvitationBySlug(ctx, strings.TrimSpace(slug))
	if err != nil {
		return nil, err
	}
	if invitation == nil {
		return nil, ErrWorkspaceInvitationNotFound
	}
	if !invitationMatchesRecipient(invitation, userID) {
		return nil, ErrWorkspaceInvitationNotRecipient
	}

	now := time.Now().UTC()
	if err := validateInvitationCanBeAccepted(invitation, now); err != nil {
		return nil, err
	}

	if err := s.repo.AcceptInvitation(ctx, invitation, userID, now); err != nil {
		return nil, err
	}

	return &AcceptWorkspaceInvitationResponse{
		WorkspaceID: invitation.WorkspaceID,
		Member: AcceptedWorkspaceInvitationMember{
			UserID: userID,
			Role:   invitation.Role,
		},
		RedirectTo: fmt.Sprintf("/workspace/%s", invitation.WorkspaceID),
	}, nil
}

func (s *service) RejectInvitation(
	ctx context.Context,
	slug string,
	userID string,
) (*RejectWorkspaceInvitationResponse, error) {
	invitation, err := s.repo.GetInvitationBySlug(ctx, strings.TrimSpace(slug))
	if err != nil {
		return nil, err
	}
	if invitation == nil {
		return nil, ErrWorkspaceInvitationNotFound
	}

	if !invitationMatchesRecipient(invitation, strings.TrimSpace(userID)) {
		return nil, ErrWorkspaceInvitationNotRecipient
	}

	if invitation.InvitedUserID != nil {
		switch resolveInvitationStatus(invitation, time.Now().UTC()) {
		case InvitationStatusRejected:
			return &RejectWorkspaceInvitationResponse{Status: "rejected"}, nil
		case InvitationStatusActive:
			invitation.Status = InvitationStatusRejected
			if err := s.repo.UpdateInvitation(ctx, invitation); err != nil {
				return nil, err
			}
		}
	}

	return &RejectWorkspaceInvitationResponse{Status: "rejected"}, nil
}

func validateInvitationCanBeAccepted(invitation *WorkspaceInvitation, now time.Time) error {
	switch resolveInvitationStatus(invitation, now) {
	case InvitationStatusActive:
		return nil
	case InvitationStatusRejected:
		return ErrWorkspaceInvitationRejected
	case InvitationStatusRevoked:
		return ErrWorkspaceInvitationRevoked
	case InvitationStatusExpired:
		return ErrWorkspaceInvitationExpired
	case InvitationStatusUsedUp:
		return ErrWorkspaceInvitationUsedUp
	default:
		return ErrWorkspaceInvitationRevoked
	}
}

func invitationMatchesRecipient(invitation *WorkspaceInvitation, userID string) bool {
	if invitation == nil || invitation.InvitedUserID == nil {
		return true
	}

	return strings.TrimSpace(*invitation.InvitedUserID) == strings.TrimSpace(userID)
}

func normalizeInvitationExpiry(expiresAt *time.Time, now time.Time) (*time.Time, error) {
	if expiresAt == nil {
		defaultExpiry := now.Add(defaultInvitationValidity)
		return &defaultExpiry, nil
	}

	normalized := expiresAt.UTC()
	if !normalized.After(now) {
		return nil, ErrWorkspaceInvitationInvalidExpiry
	}
	return &normalized, nil
}

func isInvitationRoleAllowed(role string) bool {
	switch role {
	case member.RoleAdmin, member.RoleWrite, member.RoleRead:
		return true
	default:
		return false
	}
}

func generateInvitationTokenMaterial() (rawToken, tokenPrefix, tokenHash string, err error) {
	bytes := make([]byte, 18)
	if _, err = rand.Read(bytes); err != nil {
		return "", "", "", err
	}

	rawToken = "wsi_" + hex.EncodeToString(bytes)
	tokenPrefix = rawToken
	if len(tokenPrefix) > 18 {
		tokenPrefix = tokenPrefix[:18]
	}

	return rawToken, tokenPrefix, hashInvitationToken(rawToken), nil
}

func hashInvitationToken(rawToken string) string {
	rawToken = strings.TrimSpace(rawToken)
	if rawToken == "" {
		return ""
	}

	sum := sha256.Sum256([]byte(rawToken))
	return hex.EncodeToString(sum[:])
}
