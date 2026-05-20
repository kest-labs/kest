package workspace

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/json"
	"encoding/hex"
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/gosimple/slug"
)

var (
	ErrInvalidCLIToken           = errors.New("invalid CLI token")
	ErrCLITokenExpired           = errors.New("CLI token has expired")
	ErrCLITokenScopeDenied       = errors.New("CLI token does not have the required scope")
	ErrCLITokenWorkspaceMismatch = errors.New("CLI token is not scoped to this workspace")
	ErrUnsupportedCLITokenScope  = errors.New("unsupported CLI token scope")
)

// Service defines the workspace business logic interface
type Service interface {
	// Workspace operations
	CreateWorkspace(req *CreateWorkspaceRequest, ownerID string) (*Workspace, error)
	UpdateWorkspace(id string, req *UpdateWorkspaceRequest, userID string, isSuperAdmin bool) (*Workspace, error)
	DeleteWorkspace(id string, userID string, isSuperAdmin bool) error
	GetWorkspace(id string, userID string, isSuperAdmin bool) (*Workspace, error)
	ListWorkspaces(userID string, isSuperAdmin bool) ([]*Workspace, error)

	// Member operations
	AddMember(workspaceID string, req *AddMemberRequest, inviterID string, isSuperAdmin bool) error
	RemoveMember(workspaceID, targetUserID, requesterID string, isSuperAdmin bool) error
	UpdateMemberRole(workspaceID, targetUserID string, role string, requesterID string, isSuperAdmin bool) error
	ListMembers(workspaceID, userID string, isSuperAdmin bool) ([]*WorkspaceMember, error)

	// CLI token operations
	GenerateCLIToken(ctx context.Context, workspaceID string, createdBy string, req *GenerateWorkspaceCLITokenRequest) (*GenerateWorkspaceCLITokenResponse, error)
	ListCLITokens(ctx context.Context, workspaceID string) ([]*WorkspaceCLIToken, error)
	ValidateCLIToken(ctx context.Context, workspaceID string, rawToken string, requiredScopes []string) (string, string, error)

	// Permission checks
	CheckUserRole(workspaceID, userID string, isSuperAdmin bool) (string, error)
	HasPermission(workspaceID, userID string, requiredRole string, isSuperAdmin bool) (bool, error)
}

// service implements Service interface
type service struct {
	repo Repository
}

// NewService creates a new workspace service
func NewService(repo Repository) Service {
	return &service{repo: repo}
}

// CreateWorkspace creates a new workspace
func (s *service) CreateWorkspace(req *CreateWorkspaceRequest, ownerID string) (*Workspace, error) {
	// Generate slug if not provided or sanitize it
	workspaceSlug := req.Slug
	if workspaceSlug == "" {
		workspaceSlug = slug.Make(req.Name)
	} else {
		workspaceSlug = slug.Make(workspaceSlug)
	}

	// Check if slug already exists
	existing, _ := s.repo.FindBySlug(workspaceSlug)
	if existing != nil {
		return nil, errors.New("workspace slug already exists")
	}

	// Set default visibility based on type
	visibility := req.Visibility
	if visibility == "" {
		if req.Type == TypePersonal {
			visibility = VisibilityPrivate
		} else {
			visibility = VisibilityTeam
		}
	}

	// Create workspace
	workspace := &WorkspacePO{
		Name:        req.Name,
		Slug:        workspaceSlug,
		Description: req.Description,
		Type:        req.Type,
		OwnerID:     ownerID,
		Visibility:  visibility,
	}

	if err := s.repo.Create(workspace); err != nil {
		return nil, fmt.Errorf("failed to create workspace: %w", err)
	}

	// Add owner as first member
	member := &WorkspaceMemberPO{
		WorkspaceID: workspace.ID,
		UserID:      ownerID,
		Role:        RoleOwner,
		InvitedBy:   ownerID,
		JoinedAt:    time.Now(),
	}

	if err := s.repo.AddMember(member); err != nil {
		// Rollback workspace creation if adding member fails
		s.repo.Delete(workspace.ID)
		return nil, fmt.Errorf("failed to add owner as member: %w", err)
	}

	return workspace.toDomain(), nil
}

// UpdateWorkspace updates a workspace
func (s *service) UpdateWorkspace(id string, req *UpdateWorkspaceRequest, userID string, isSuperAdmin bool) (*Workspace, error) {
	// Check permission (only owner and admin can update, or super admin)
	hasPermission, err := s.repo.HasPermission(id, userID, RoleAdmin, isSuperAdmin)
	if err != nil {
		return nil, err
	}
	if !hasPermission {
		return nil, errors.New("insufficient permissions to update workspace")
	}

	// Get existing workspace
	workspace, err := s.repo.FindByID(id)
	if err != nil {
		return nil, err
	}

	// Update fields
	if req.Name != nil {
		workspace.Name = *req.Name
	}
	if req.Description != nil {
		workspace.Description = *req.Description
	}
	if req.Visibility != nil {
		workspace.Visibility = *req.Visibility
	}
	if req.Settings != nil {
		settingsBytes, err := json.Marshal(req.Settings)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal workspace settings: %w", err)
		}
		workspace.Settings = string(settingsBytes)
	}

	if err := s.repo.Update(workspace); err != nil {
		return nil, err
	}

	return workspace.toDomain(), nil
}

// DeleteWorkspace deletes a workspace (only owner or super admin can delete)
func (s *service) DeleteWorkspace(id string, userID string, isSuperAdmin bool) error {
	workspace, err := s.repo.FindByID(id)
	if err != nil {
		return err
	}

	// Only owner or super admin can delete
	if !isSuperAdmin && workspace.OwnerID != userID {
		return errors.New("only workspace owner can delete workspace")
	}

	return s.repo.Delete(id)
}

// GetWorkspace gets a workspace by ID
func (s *service) GetWorkspace(id string, userID string, isSuperAdmin bool) (*Workspace, error) {
	// Check if user has access
	hasPermission, err := s.repo.HasPermission(id, userID, RoleRead, isSuperAdmin)
	if err != nil {
		return nil, err
	}
	if !hasPermission {
		return nil, errors.New("workspace not found or access denied")
	}

	workspace, err := s.repo.FindByID(id)
	if err != nil {
		return nil, err
	}

	return workspace.toDomain(), nil
}

// ListWorkspaces lists all workspaces accessible to a user
func (s *service) ListWorkspaces(userID string, isSuperAdmin bool) ([]*Workspace, error) {
	workspaces, err := s.repo.ListByUserID(userID, isSuperAdmin)
	if err != nil {
		return nil, err
	}

	return toDomainList(workspaces), nil
}

// AddMember adds a member to a workspace
func (s *service) AddMember(workspaceID string, req *AddMemberRequest, inviterID string, isSuperAdmin bool) error {
	// Only admin and owner can add members (or super admin)
	hasPermission, err := s.repo.HasPermission(workspaceID, inviterID, RoleAdmin, isSuperAdmin)
	if err != nil {
		return err
	}
	if !hasPermission {
		return errors.New("insufficient permissions to add members")
	}

	// Check if user is already a member
	existing, _ := s.repo.FindMember(workspaceID, req.UserID.String())
	if existing != nil {
		return errors.New("user is already a member of this workspace")
	}

	member := &WorkspaceMemberPO{
		WorkspaceID: workspaceID,
		UserID:      req.UserID.String(),
		Role:        req.Role,
		InvitedBy:   inviterID,
		JoinedAt:    time.Now(),
	}

	return s.repo.AddMember(member)
}

// RemoveMember removes a member from a workspace
func (s *service) RemoveMember(workspaceID, targetUserID, requesterID string, isSuperAdmin bool) error {
	// Get workspace to check owner
	workspace, err := s.repo.FindByID(workspaceID)
	if err != nil {
		return err
	}

	// Cannot remove owner
	if workspace.OwnerID == targetUserID {
		return errors.New("cannot remove workspace owner")
	}

	// Super admin can remove anyone (except owner)
	if isSuperAdmin {
		return s.repo.RemoveMember(workspaceID, targetUserID)
	}

	// Regular users: owner and admin can remove members
	hasPermission, err := s.repo.HasPermission(workspaceID, requesterID, RoleAdmin, false)
	if err != nil {
		return err
	}
	if !hasPermission {
		return errors.New("insufficient permissions to remove members")
	}

	return s.repo.RemoveMember(workspaceID, targetUserID)
}

// UpdateMemberRole updates a member's role
func (s *service) UpdateMemberRole(workspaceID, targetUserID string, role string, requesterID string, isSuperAdmin bool) error {
	// Get workspace
	workspace, err := s.repo.FindByID(workspaceID)
	if err != nil {
		return err
	}

	// Cannot change owner's role
	if workspace.OwnerID == targetUserID {
		return errors.New("cannot change workspace owner's role")
	}

	// Super admin can change any role (except owner)
	if isSuperAdmin {
		return s.repo.UpdateMemberRole(workspaceID, targetUserID, role)
	}

	// Regular users: only owner and admin can change roles
	hasPermission, err := s.repo.HasPermission(workspaceID, requesterID, RoleAdmin, false)
	if err != nil {
		return err
	}
	if !hasPermission {
		return errors.New("insufficient permissions to update member roles")
	}

	return s.repo.UpdateMemberRole(workspaceID, targetUserID, role)
}

// ListMembers lists all members of a workspace
func (s *service) ListMembers(workspaceID, userID string, isSuperAdmin bool) ([]*WorkspaceMember, error) {
	// Check if user has access to workspace
	hasPermission, err := s.repo.HasPermission(workspaceID, userID, RoleRead, isSuperAdmin)
	if err != nil {
		return nil, err
	}
	if !hasPermission {
		return nil, errors.New("workspace not found or access denied")
	}

	members, err := s.repo.ListMembers(workspaceID)
	if err != nil {
		return nil, err
	}

	return toMemberDomainList(members), nil
}

func (s *service) GenerateCLIToken(ctx context.Context, workspaceID string, createdBy string, req *GenerateWorkspaceCLITokenRequest) (*GenerateWorkspaceCLITokenResponse, error) {
	if req == nil {
		req = &GenerateWorkspaceCLITokenRequest{}
	}

	workspace, err := s.repo.FindByID(workspaceID)
	if err != nil {
		return nil, err
	}

	scopes, err := normalizeCLITokenScopes(req.Scopes)
	if err != nil {
		return nil, err
	}

	rawToken, tokenPrefix, tokenHash, err := generateCLITokenMaterial()
	if err != nil {
		return nil, fmt.Errorf("failed to generate CLI token: %w", err)
	}

	name := strings.TrimSpace(req.Name)
	if name == "" {
		name = fmt.Sprintf("%s CLI token", workspace.Name)
	}

	token := &WorkspaceCLIToken{
		WorkspaceID: workspaceID,
		CreatedBy:   createdBy,
		Name:        name,
		TokenPrefix: tokenPrefix,
		Scopes:      scopes,
		ExpiresAt:   req.ExpiresAt,
	}

	if err := s.repo.CreateCLIToken(ctx, token, tokenHash); err != nil {
		return nil, err
	}

	return &GenerateWorkspaceCLITokenResponse{
		Token:       rawToken,
		TokenType:   "bearer",
		WorkspaceID: workspaceID,
		TokenInfo:   FromCLIToken(token),
	}, nil
}

func (s *service) ListCLITokens(ctx context.Context, workspaceID string) ([]*WorkspaceCLIToken, error) {
	return s.repo.ListCLITokens(ctx, workspaceID)
}

func (s *service) ValidateCLIToken(ctx context.Context, workspaceID string, rawToken string, requiredScopes []string) (string, string, error) {
	tokenHash := hashCLIToken(strings.TrimSpace(rawToken))
	if tokenHash == "" {
		return "", "", ErrInvalidCLIToken
	}

	token, err := s.repo.GetCLITokenByHash(ctx, tokenHash)
	if err != nil {
		return "", "", err
	}
	if token == nil {
		return "", "", ErrInvalidCLIToken
	}
	if token.WorkspaceID != workspaceID {
		return "", "", ErrCLITokenWorkspaceMismatch
	}
	if token.ExpiresAt != nil && token.ExpiresAt.Before(time.Now()) {
		return "", "", ErrCLITokenExpired
	}

	scopes, err := normalizeRequiredCLITokenScopes(requiredScopes)
	if err != nil {
		return "", "", err
	}
	if !hasRequiredScopes(token.Scopes, scopes) {
		return "", "", ErrCLITokenScopeDenied
	}

	if err := s.repo.TouchCLIToken(ctx, token.ID, time.Now().UTC()); err != nil {
		return "", "", err
	}

	return token.ID, token.CreatedBy, nil
}

// CheckUserRole returns the user's role in a workspace
func (s *service) CheckUserRole(workspaceID, userID string, isSuperAdmin bool) (string, error) {
	return s.repo.CheckPermission(workspaceID, userID, isSuperAdmin)
}

// HasPermission checks if a user has at least the required role level
func (s *service) HasPermission(workspaceID, userID string, requiredRole string, isSuperAdmin bool) (bool, error) {
	return s.repo.HasPermission(workspaceID, userID, requiredRole, isSuperAdmin)
}

func generateCLITokenMaterial() (rawToken, tokenPrefix, tokenHash string, err error) {
	bytes := make([]byte, 24)
	if _, err = rand.Read(bytes); err != nil {
		return "", "", "", err
	}

	rawToken = "kest_pat_" + hex.EncodeToString(bytes)
	tokenPrefix = rawToken
	if len(tokenPrefix) > 18 {
		tokenPrefix = tokenPrefix[:18]
	}

	return rawToken, tokenPrefix, hashCLIToken(rawToken), nil
}

func hashCLIToken(rawToken string) string {
	rawToken = strings.TrimSpace(rawToken)
	if rawToken == "" {
		return ""
	}

	sum := sha256.Sum256([]byte(rawToken))
	return hex.EncodeToString(sum[:])
}

func normalizeCLITokenScopes(scopes []string) ([]string, error) {
	if len(scopes) == 0 {
		return []string{
			CLITokenScopeCollectionRead,
			CLITokenScopeCollectionRun,
			CLITokenScopeEnvironmentRead,
			CLITokenScopeTestCaseRun,
			CLITokenScopeFlowRun,
		}, nil
	}

	seen := make(map[string]struct{}, len(scopes))
	normalized := make([]string, 0, len(scopes))
	for _, scope := range scopes {
		scope = strings.TrimSpace(scope)
		if scope == "" {
			continue
		}
		if _, ok := supportedCLITokenScopes[scope]; !ok {
			return nil, fmt.Errorf("%w: %s", ErrUnsupportedCLITokenScope, scope)
		}
		if _, exists := seen[scope]; exists {
			continue
		}
		seen[scope] = struct{}{}
		normalized = append(normalized, scope)
	}

	if len(normalized) == 0 {
		return normalizeCLITokenScopes(nil)
	}

	sort.Strings(normalized)
	return normalized, nil
}

func normalizeRequiredCLITokenScopes(scopes []string) ([]string, error) {
	if len(scopes) == 0 {
		return nil, nil
	}

	return normalizeCLITokenScopes(scopes)
}

func hasRequiredScopes(actual, required []string) bool {
	if len(required) == 0 {
		return true
	}

	available := make(map[string]struct{}, len(actual))
	for _, scope := range actual {
		available[scope] = struct{}{}
	}

	for _, scope := range required {
		if _, ok := available[scope]; !ok {
			return false
		}
	}

	return true
}
