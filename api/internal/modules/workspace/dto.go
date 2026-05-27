package workspace

import (
	"time"

	idpkg "github.com/kest-labs/kest/api/pkg/id"
)

// DTO (Data Transfer Objects) for workspace module

// CreateWorkspaceRequest represents the request to create a workspace
type CreateWorkspaceRequest struct {
	Name        string `json:"name" binding:"required,max=100"`
	Slug        string `json:"slug" binding:"required,max=50,alphanum"`
	Description string `json:"description" binding:"max=500"`
	Type        string `json:"type" binding:"required,oneof=personal team public"`
	Visibility  string `json:"visibility" binding:"oneof=private team public"`
}

// UpdateWorkspaceRequest represents the request to update a workspace
type UpdateWorkspaceRequest struct {
	Name        *string `json:"name" binding:"omitempty,max=100"`
	Description *string `json:"description" binding:"omitempty,max=500"`
	Visibility  *string `json:"visibility" binding:"omitempty,oneof=private team public"`
}

// AddMemberRequest represents the request to add a member
type AddMemberRequest struct {
	UserID idpkg.Compatible `json:"user_id" binding:"required" swaggertype:"string"`
	Role   string           `json:"role" binding:"required,oneof=owner admin write read"`
}

// UpdateMemberRoleRequest represents the request to update member role
type UpdateMemberRoleRequest struct {
	Role string `json:"role" binding:"required,oneof=owner admin write read"`
}

type GenerateWorkspaceCLITokenRequest struct {
	Name      string     `json:"name" binding:"omitempty,max=100"`
	Scopes    []string   `json:"scopes"`
	ExpiresAt *time.Time `json:"expires_at"`
}

// WorkspaceResponse represents the workspace response
type WorkspaceResponse struct {
	ID          string                 `json:"id"`
	Name        string                 `json:"name"`
	Slug        string                 `json:"slug"`
	Description string                 `json:"description"`
	Type        string                 `json:"type"`
	OwnerID     string                 `json:"owner_id"`
	Visibility  string                 `json:"visibility"`
	Settings    map[string]interface{} `json:"settings,omitempty"`
	CreatedAt   string                 `json:"created_at"`
	UpdatedAt   string                 `json:"updated_at"`
}

// WorkspaceMemberResponse represents the member response
type WorkspaceMemberResponse struct {
	ID          string `json:"id"`
	WorkspaceID string `json:"workspace_id"`
	UserID      string `json:"user_id"`
	Username    string `json:"username,omitempty"` // Joined from users table
	Email       string `json:"email,omitempty"`    // Joined from users table
	Role        string `json:"role"`
	InvitedBy   string `json:"invited_by"`
	JoinedAt    string `json:"joined_at"`
	CreatedAt   string `json:"created_at"`
	UpdatedAt   string `json:"updated_at"`
}

type WorkspaceCLITokenResponse struct {
	ID          string     `json:"id"`
	WorkspaceID string     `json:"workspace_id"`
	Name        string     `json:"name"`
	TokenPrefix string     `json:"token_prefix"`
	Scopes      []string   `json:"scopes"`
	LastUsedAt  *time.Time `json:"last_used_at,omitempty"`
	ExpiresAt   *time.Time `json:"expires_at,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
}

type GenerateWorkspaceCLITokenResponse struct {
	Token       string                     `json:"token"`
	TokenType   string                     `json:"token_type"`
	WorkspaceID string                     `json:"workspace_id"`
	TokenInfo   *WorkspaceCLITokenResponse `json:"token_info"`
}

// FromWorkspace converts domain Workspace to WorkspaceResponse
func FromWorkspace(w *Workspace) *WorkspaceResponse {
	if w == nil {
		return nil
	}
	return &WorkspaceResponse{
		ID:          w.ID,
		Name:        w.Name,
		Slug:        w.Slug,
		Description: w.Description,
		Type:        w.Type,
		OwnerID:     w.OwnerID,
		Visibility:  w.Visibility,
		Settings:    w.Settings,
		CreatedAt:   w.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		UpdatedAt:   w.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}
}

// FromWorkspaceList converts workspace list to response list
func FromWorkspaceList(workspaces []*Workspace) []*WorkspaceResponse {
	result := make([]*WorkspaceResponse, len(workspaces))
	for i, w := range workspaces {
		result[i] = FromWorkspace(w)
	}
	return result
}

// FromMember converts domain WorkspaceMember to response
func FromMember(m *WorkspaceMember) *WorkspaceMemberResponse {
	if m == nil {
		return nil
	}
	return &WorkspaceMemberResponse{
		ID:          m.ID,
		WorkspaceID: m.WorkspaceID,
		UserID:      m.UserID,
		Username:    m.Username,
		Email:       m.Email,
		Role:        m.Role,
		InvitedBy:   m.InvitedBy,
		JoinedAt:    m.JoinedAt.Format("2006-01-02T15:04:05Z07:00"),
		CreatedAt:   m.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		UpdatedAt:   m.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}
}

// FromMemberList converts member list to response list
func FromMemberList(members []*WorkspaceMember) []*WorkspaceMemberResponse {
	result := make([]*WorkspaceMemberResponse, len(members))
	for i, m := range members {
		result[i] = FromMember(m)
	}
	return result
}

func FromCLIToken(token *WorkspaceCLIToken) *WorkspaceCLITokenResponse {
	if token == nil {
		return nil
	}

	return &WorkspaceCLITokenResponse{
		ID:          token.ID,
		WorkspaceID: token.WorkspaceID,
		Name:        token.Name,
		TokenPrefix: token.TokenPrefix,
		Scopes:      token.Scopes,
		LastUsedAt:  token.LastUsedAt,
		ExpiresAt:   token.ExpiresAt,
		CreatedAt:   token.CreatedAt,
	}
}

func FromCLITokenList(tokens []*WorkspaceCLIToken) []*WorkspaceCLITokenResponse {
	result := make([]*WorkspaceCLITokenResponse, len(tokens))
	for i, token := range tokens {
		result[i] = FromCLIToken(token)
	}
	return result
}
