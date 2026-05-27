package workspace

import (
	"encoding/json"
	"time"

	"gorm.io/gorm"
)

// Workspace types
const (
	TypePersonal = "personal"
	TypeTeam     = "team"
	TypePublic   = "public"
)

// Visibility types
const (
	VisibilityPrivate = "private"
	VisibilityTeam    = "team"
	VisibilityPublic  = "public"
)

// WorkspacePO is the persistent object for database operations
type WorkspacePO struct {
	ID          string `gorm:"primaryKey"`
	Name        string `gorm:"size:100;not null"`
	Slug        string `gorm:"size:50;uniqueIndex"`
	Description string `gorm:"size:500"`
	Type        string `gorm:"size:20;not null;default:'personal'"` // personal|team|public
	OwnerID     string `gorm:"not null;index"`                      // Creator
	Visibility  string `gorm:"size:20;default:'private'"`           // private|team|public
	Settings    string `gorm:"type:text"`                           // JSON settings as string
	CreatedAt   time.Time
	UpdatedAt   time.Time
	DeletedAt   gorm.DeletedAt `gorm:"index"`
}

// TableName specifies the database table name
func (WorkspacePO) TableName() string {
	return "workspaces"
}

// WorkspaceMemberPO represents a membership of a user in a workspace
type WorkspaceMemberPO struct {
	ID          string `gorm:"primaryKey"`
	WorkspaceID string `gorm:"index;uniqueIndex:idx_workspace_user;not null"`
	UserID      string `gorm:"index;uniqueIndex:idx_workspace_user;not null"`
	User        WorkspaceMemberUserPO `gorm:"foreignKey:UserID;references:ID"`
	Role        string `gorm:"size:20;not null"` // owner|admin|write|read
	InvitedBy   string `gorm:"index"`            // Inviter user ID
	JoinedAt    time.Time
	CreatedAt   time.Time
	UpdatedAt   time.Time
	DeletedAt   gorm.DeletedAt `gorm:"index"`
}

// TableName specifies the database table name
func (WorkspaceMemberPO) TableName() string {
	return "workspace_members"
}

type WorkspaceMemberUserPO struct {
	ID       string `gorm:"primaryKey"`
	Username string `gorm:"column:username"`
	Email    string `gorm:"column:email"`
}

func (WorkspaceMemberUserPO) TableName() string {
	return "users"
}

const (
	CLITokenScopeCollectionRead  = "collection:read"
	CLITokenScopeCollectionRun   = "collection:run"
	CLITokenScopeEnvironmentRead = "environment:read"
	CLITokenScopeTestCaseRun     = "test_case:run"
	CLITokenScopeFlowRun         = "flow:run"
)

var supportedCLITokenScopes = map[string]struct{}{
	CLITokenScopeCollectionRead:  {},
	CLITokenScopeCollectionRun:   {},
	CLITokenScopeEnvironmentRead: {},
	CLITokenScopeTestCaseRun:     {},
	CLITokenScopeFlowRun:         {},
}

// WorkspaceCLITokenPO persists workspace-scoped CLI tokens. TokenHash is the
// only stored secret; raw tokens are returned only during creation.
type WorkspaceCLITokenPO struct {
	ID          string `gorm:"primaryKey"`
	WorkspaceID string `gorm:"not null;index"`
	CreatedBy   string `gorm:"not null;index"`
	Name        string `gorm:"size:100;not null"`
	TokenPrefix string `gorm:"size:32;not null;index"`
	TokenHash   string `gorm:"size:64;not null;uniqueIndex"`
	Scopes      string `gorm:"type:text"`
	LastUsedAt  *time.Time
	ExpiresAt   *time.Time
	CreatedAt   time.Time
	UpdatedAt   time.Time
	DeletedAt   gorm.DeletedAt `gorm:"index"`
}

func (WorkspaceCLITokenPO) TableName() string {
	return "workspace_cli_tokens"
}

// WorkspaceCLIToken is the service-layer representation of a CLI token.
type WorkspaceCLIToken struct {
	ID          string     `json:"id"`
	WorkspaceID string     `json:"workspace_id"`
	CreatedBy   string     `json:"created_by"`
	Name        string     `json:"name"`
	TokenPrefix string     `json:"token_prefix"`
	Scopes      []string   `json:"scopes"`
	LastUsedAt  *time.Time `json:"last_used_at,omitempty"`
	ExpiresAt   *time.Time `json:"expires_at,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}

// Role constants
const (
	RoleOwner = "owner"
	RoleAdmin = "admin"
	RoleWrite = "write"
	RoleRead  = "read"
)

// RoleLevel defines the hierarchy of roles
var RoleLevel = map[string]int{
	RoleOwner: 40,
	RoleAdmin: 30,
	RoleWrite: 20,
	RoleRead:  10,
}

// Workspace is the domain entity
type Workspace struct {
	ID          string                 `json:"id"`
	Name        string                 `json:"name"`
	Slug        string                 `json:"slug"`
	Description string                 `json:"description"`
	Type        string                 `json:"type"`
	OwnerID     string                 `json:"owner_id"`
	Visibility  string                 `json:"visibility"`
	Settings    map[string]interface{} `json:"settings,omitempty"`
	CreatedAt   time.Time              `json:"created_at"`
	UpdatedAt   time.Time              `json:"updated_at"`
}

// WorkspaceMember is the domain entity for membership
type WorkspaceMember struct {
	ID          string    `json:"id"`
	WorkspaceID string    `json:"workspace_id"`
	UserID      string    `json:"user_id"`
	Username    string    `json:"username,omitempty"`
	Email       string    `json:"email,omitempty"`
	Role        string    `json:"role"`
	InvitedBy   string    `json:"invited_by"`
	JoinedAt    time.Time `json:"joined_at"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// toDomain converts WorkspacePO to Workspace domain entity
func (po *WorkspacePO) toDomain() *Workspace {
	if po == nil {
		return nil
	}

	var settings map[string]interface{}
	if po.Settings != "" {
		// Parse JSON string to map (ignore errors, use empty map)
		_ = json.Unmarshal([]byte(po.Settings), &settings)
	}

	return &Workspace{
		ID:          po.ID,
		Name:        po.Name,
		Slug:        po.Slug,
		Description: po.Description,
		Type:        po.Type,
		OwnerID:     po.OwnerID,
		Visibility:  po.Visibility,
		Settings:    settings,
		CreatedAt:   po.CreatedAt,
		UpdatedAt:   po.UpdatedAt,
	}
}

// toDomainList converts a slice of WorkspacePO to Workspace slice
func toDomainList(poList []*WorkspacePO) []*Workspace {
	result := make([]*Workspace, len(poList))
	for i, po := range poList {
		result[i] = po.toDomain()
	}
	return result
}

// toMemberDomain converts WorkspaceMemberPO to WorkspaceMember
func (po *WorkspaceMemberPO) toMemberDomain() *WorkspaceMember {
	if po == nil {
		return nil
	}
	return &WorkspaceMember{
		ID:          po.ID,
		WorkspaceID: po.WorkspaceID,
		UserID:      po.UserID,
		Username:    po.User.Username,
		Email:       po.User.Email,
		Role:        po.Role,
		InvitedBy:   po.InvitedBy,
		JoinedAt:    po.JoinedAt,
		CreatedAt:   po.CreatedAt,
		UpdatedAt:   po.UpdatedAt,
	}
}

// toMemberDomainList converts slice of members
func toMemberDomainList(poList []*WorkspaceMemberPO) []*WorkspaceMember {
	result := make([]*WorkspaceMember, len(poList))
	for i, po := range poList {
		result[i] = po.toMemberDomain()
	}
	return result
}

func (po *WorkspaceCLITokenPO) toDomain() *WorkspaceCLIToken {
	if po == nil {
		return nil
	}

	token := &WorkspaceCLIToken{
		ID:          po.ID,
		WorkspaceID: po.WorkspaceID,
		CreatedBy:   po.CreatedBy,
		Name:        po.Name,
		TokenPrefix: po.TokenPrefix,
		LastUsedAt:  po.LastUsedAt,
		ExpiresAt:   po.ExpiresAt,
		CreatedAt:   po.CreatedAt,
		UpdatedAt:   po.UpdatedAt,
	}

	if po.Scopes != "" {
		_ = json.Unmarshal([]byte(po.Scopes), &token.Scopes)
	}

	return token
}

func newWorkspaceCLITokenPO(token *WorkspaceCLIToken, tokenHash string) *WorkspaceCLITokenPO {
	if token == nil {
		return nil
	}

	scopesJSON, _ := json.Marshal(token.Scopes)

	return &WorkspaceCLITokenPO{
		ID:          token.ID,
		WorkspaceID: token.WorkspaceID,
		CreatedBy:   token.CreatedBy,
		Name:        token.Name,
		TokenPrefix: token.TokenPrefix,
		TokenHash:   tokenHash,
		Scopes:      string(scopesJSON),
		LastUsedAt:  token.LastUsedAt,
		ExpiresAt:   token.ExpiresAt,
	}
}
