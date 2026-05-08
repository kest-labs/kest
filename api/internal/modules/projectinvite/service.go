package projectinvite

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
	ErrProjectInvitationNotFound      = errors.New("project invitation not found")
	ErrProjectInvitationInvalidRole   = errors.New("invalid project invitation role")
	ErrProjectInvitationInvalidUses   = errors.New("max_uses must be greater than or equal to 0")
	ErrProjectInvitationInvalidExpiry = errors.New("expires_at must be in the future")
	ErrProjectInvitationExpired       = errors.New("project invitation has expired")
	ErrProjectInvitationRejected      = errors.New("project invitation has been rejected")
	ErrProjectInvitationRevoked       = errors.New("project invitation has been revoked")
	ErrProjectInvitationUsedUp        = errors.New("project invitation has no remaining uses")
	ErrProjectInvitationAlreadyMember = errors.New("user is already a member of this project")
	ErrProjectInvitationNotRecipient  = errors.New("project invitation is not assigned to this user")
)

type Service interface {
	CreateInvitation(
		ctx context.Context,
		projectID string,
		createdBy string,
		req *CreateProjectInvitationRequest,
	) (*ProjectInvitationResponse, error)
	ListInvitations(ctx context.Context, projectID string) ([]*ProjectInvitationResponse, error)
	ListReceivedInvitations(
		ctx context.Context,
		userID string,
	) ([]*ReceivedProjectInvitationResponse, error)
	RevokeInvitation(ctx context.Context, projectID, invitationID string) error
	GetInvitationDetail(
		ctx context.Context,
		slug string,
	) (*PublicProjectInvitationResponse, error)
	AcceptInvitation(
		ctx context.Context,
		slug string,
		userID string,
	) (*AcceptProjectInvitationResponse, error)
	RejectInvitation(
		ctx context.Context,
		slug string,
		userID string,
	) (*RejectProjectInvitationResponse, error)
}

type service struct {
	repo Repository
}

func NewService(repo Repository) Service {
	return &service{repo: repo}
}

func (s *service) CreateInvitation(
	ctx context.Context,
	projectID string,
	createdBy string,
	req *CreateProjectInvitationRequest,
) (*ProjectInvitationResponse, error) {
	if req == nil {
		req = &CreateProjectInvitationRequest{}
	}

	role := strings.TrimSpace(req.Role)
	if !isInvitationRoleAllowed(role) {
		return nil, ErrProjectInvitationInvalidRole
	}

	invitedUserID := strings.TrimSpace(req.InvitedUserID)
	now := time.Now().UTC()
	maxUses := 1
	if req.MaxUses != nil {
		maxUses = *req.MaxUses
	}
	if maxUses < 0 {
		return nil, ErrProjectInvitationInvalidUses
	}

	expiresAt, err := normalizeInvitationExpiry(req.ExpiresAt, now)
	if err != nil {
		return nil, err
	}

	if invitedUserID != "" {
		isMember, err := s.repo.HasProjectMember(ctx, projectID, invitedUserID)
		if err != nil {
			return nil, err
		}
		if isMember {
			return nil, ErrProjectInvitationAlreadyMember
		}

		// Direct invitations are one-to-one and always single-use. Replace any
		// previously pending direct invite so the recipient sees a single action.
		maxUses = 1
		if err := s.repo.RevokeActiveInvitationsForUser(ctx, projectID, invitedUserID); err != nil {
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

	invitation := &ProjectInvitation{
		ProjectID:     projectID,
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

	return toProjectInvitationResponse(invitation, now), nil
}

func (s *service) ListInvitations(
	ctx context.Context,
	projectID string,
) ([]*ProjectInvitationResponse, error) {
	invitations, err := s.repo.ListInvitationsByProject(ctx, projectID)
	if err != nil {
		return nil, err
	}

	now := time.Now().UTC()
	result := make([]*ProjectInvitationResponse, 0, len(invitations))
	for _, invitation := range invitations {
		result = append(result, toProjectInvitationResponse(invitation, now))
	}
	return result, nil
}

func (s *service) ListReceivedInvitations(
	ctx context.Context,
	userID string,
) ([]*ReceivedProjectInvitationResponse, error) {
	invitations, err := s.repo.ListInvitationsByInvitedUser(ctx, strings.TrimSpace(userID))
	if err != nil {
		return nil, err
	}

	now := time.Now().UTC()
	result := make([]*ReceivedProjectInvitationResponse, 0, len(invitations))
	for _, invitation := range invitations {
		if resolveInvitationStatus(invitation, now) != InvitationStatusActive {
			continue
		}

		projectSummary, err := s.repo.GetProjectSummary(ctx, invitation.ProjectID)
		if err != nil {
			return nil, err
		}
		if projectSummary == nil {
			continue
		}

		result = append(result, toReceivedProjectInvitationResponse(invitation, projectSummary, now))
	}

	return result, nil
}

func (s *service) RevokeInvitation(ctx context.Context, projectID, invitationID string) error {
	invitation, err := s.repo.GetInvitationByProject(ctx, projectID, invitationID)
	if err != nil {
		return err
	}
	if invitation == nil {
		return ErrProjectInvitationNotFound
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
) (*PublicProjectInvitationResponse, error) {
	slug = strings.TrimSpace(slug)
	if slug == "" {
		return nil, ErrProjectInvitationNotFound
	}

	invitation, err := s.repo.GetInvitationBySlug(ctx, slug)
	if err != nil {
		return nil, err
	}
	if invitation == nil {
		return nil, ErrProjectInvitationNotFound
	}

	projectSummary, err := s.repo.GetProjectSummary(ctx, invitation.ProjectID)
	if err != nil {
		return nil, err
	}
	if projectSummary == nil {
		return nil, ErrProjectInvitationNotFound
	}

	return toPublicProjectInvitationResponse(invitation, projectSummary, time.Now().UTC()), nil
}

func (s *service) AcceptInvitation(
	ctx context.Context,
	slug string,
	userID string,
) (*AcceptProjectInvitationResponse, error) {
	invitation, err := s.repo.GetInvitationBySlug(ctx, strings.TrimSpace(slug))
	if err != nil {
		return nil, err
	}
	if invitation == nil {
		return nil, ErrProjectInvitationNotFound
	}
	if !invitationMatchesRecipient(invitation, userID) {
		return nil, ErrProjectInvitationNotRecipient
	}

	now := time.Now().UTC()
	if err := validateInvitationCanBeAccepted(invitation, now); err != nil {
		return nil, err
	}

	if err := s.repo.AcceptInvitation(ctx, invitation, userID, now); err != nil {
		return nil, err
	}

	return &AcceptProjectInvitationResponse{
		ProjectID: invitation.ProjectID,
		Member: AcceptedProjectInvitationMember{
			UserID: userID,
			Role:   invitation.Role,
		},
		RedirectTo: fmt.Sprintf("/project/%s", invitation.ProjectID),
	}, nil
}

func (s *service) RejectInvitation(
	ctx context.Context,
	slug string,
	userID string,
) (*RejectProjectInvitationResponse, error) {
	invitation, err := s.repo.GetInvitationBySlug(ctx, strings.TrimSpace(slug))
	if err != nil {
		return nil, err
	}
	if invitation == nil {
		return nil, ErrProjectInvitationNotFound
	}

	if !invitationMatchesRecipient(invitation, strings.TrimSpace(userID)) {
		return nil, ErrProjectInvitationNotRecipient
	}

	if invitation.InvitedUserID != nil {
		switch resolveInvitationStatus(invitation, time.Now().UTC()) {
		case InvitationStatusRejected:
			return &RejectProjectInvitationResponse{Status: "rejected"}, nil
		case InvitationStatusActive:
			invitation.Status = InvitationStatusRejected
			if err := s.repo.UpdateInvitation(ctx, invitation); err != nil {
				return nil, err
			}
		}
	}

	return &RejectProjectInvitationResponse{Status: "rejected"}, nil
}

func validateInvitationCanBeAccepted(invitation *ProjectInvitation, now time.Time) error {
	switch resolveInvitationStatus(invitation, now) {
	case InvitationStatusActive:
		return nil
	case InvitationStatusRejected:
		return ErrProjectInvitationRejected
	case InvitationStatusRevoked:
		return ErrProjectInvitationRevoked
	case InvitationStatusExpired:
		return ErrProjectInvitationExpired
	case InvitationStatusUsedUp:
		return ErrProjectInvitationUsedUp
	default:
		return ErrProjectInvitationRevoked
	}
}

func invitationMatchesRecipient(invitation *ProjectInvitation, userID string) bool {
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
		return nil, ErrProjectInvitationInvalidExpiry
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

	rawToken = "pji_" + hex.EncodeToString(bytes)
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
