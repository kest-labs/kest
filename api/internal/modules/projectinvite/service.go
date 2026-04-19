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
	ErrProjectInvitationRevoked       = errors.New("project invitation has been revoked")
	ErrProjectInvitationUsedUp        = errors.New("project invitation has no remaining uses")
	ErrProjectInvitationAlreadyMember = errors.New("user is already a member of this project")
)

type Service interface {
	CreateInvitation(
		ctx context.Context,
		projectID, createdBy uint,
		req *CreateProjectInvitationRequest,
	) (*ProjectInvitationResponse, error)
	ListInvitations(ctx context.Context, projectID uint) ([]*ProjectInvitationResponse, error)
	RevokeInvitation(ctx context.Context, projectID, invitationID uint) error
	GetInvitationDetail(
		ctx context.Context,
		slug string,
	) (*PublicProjectInvitationResponse, error)
	AcceptInvitation(
		ctx context.Context,
		slug string,
		userID uint,
	) (*AcceptProjectInvitationResponse, error)
	RejectInvitation(
		ctx context.Context,
		slug string,
		userID uint,
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
	projectID, createdBy uint,
	req *CreateProjectInvitationRequest,
) (*ProjectInvitationResponse, error) {
	if req == nil {
		req = &CreateProjectInvitationRequest{}
	}

	role := strings.TrimSpace(req.Role)
	if !isInvitationRoleAllowed(role) {
		return nil, ErrProjectInvitationInvalidRole
	}

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

	rawToken, tokenPrefix, tokenHash, err := generateInvitationTokenMaterial()
	if err != nil {
		return nil, fmt.Errorf("failed to generate invitation token: %w", err)
	}

	invitation := &ProjectInvitation{
		ProjectID:   projectID,
		TokenPrefix: tokenPrefix,
		Slug:        rawToken,
		Role:        role,
		CreatedBy:   createdBy,
		Status:      InvitationStatusActive,
		MaxUses:     maxUses,
		ExpiresAt:   expiresAt,
	}

	if err := s.repo.CreateInvitation(ctx, invitation, tokenHash); err != nil {
		return nil, err
	}

	return toProjectInvitationResponse(invitation, now), nil
}

func (s *service) ListInvitations(
	ctx context.Context,
	projectID uint,
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

func (s *service) RevokeInvitation(ctx context.Context, projectID, invitationID uint) error {
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
	userID uint,
) (*AcceptProjectInvitationResponse, error) {
	invitation, err := s.repo.GetInvitationBySlug(ctx, strings.TrimSpace(slug))
	if err != nil {
		return nil, err
	}
	if invitation == nil {
		return nil, ErrProjectInvitationNotFound
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
		RedirectTo: fmt.Sprintf("/project/%d", invitation.ProjectID),
	}, nil
}

func (s *service) RejectInvitation(
	ctx context.Context,
	slug string,
	_ uint,
) (*RejectProjectInvitationResponse, error) {
	invitation, err := s.repo.GetInvitationBySlug(ctx, strings.TrimSpace(slug))
	if err != nil {
		return nil, err
	}
	if invitation == nil {
		return nil, ErrProjectInvitationNotFound
	}

	return &RejectProjectInvitationResponse{Status: "rejected"}, nil
}

func validateInvitationCanBeAccepted(invitation *ProjectInvitation, now time.Time) error {
	switch resolveInvitationStatus(invitation, now) {
	case InvitationStatusActive:
		return nil
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
