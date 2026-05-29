package workspace

import (
	"context"
	"errors"
	"time"

	"gorm.io/gorm"

	"github.com/kest-labs/kest/api/pkg/dbutil"
)

// Repository defines the data access interface for workspace operations
type Repository interface {
	// Workspace CRUD
	Create(workspace *WorkspacePO) error
	Update(workspace *WorkspacePO) error
	Delete(id string) error
	FindByID(id string) (*WorkspacePO, error)
	FindBySlug(slug string) (*WorkspacePO, error)
	FindByOwnerID(ownerID string) ([]*WorkspacePO, error)

	// List workspaces accessible to a user (as member or super admin)
	ListByUserID(userID string, isSuperAdmin bool) ([]*WorkspacePO, error)
	GetStats(ctx context.Context, workspaceID string) (*WorkspaceStats, error)

	// Member management
	AddMember(member *WorkspaceMemberPO) error
	RemoveMember(workspaceID, userID string) error
	UpdateMemberRole(workspaceID, userID string, role string) error
	FindMember(workspaceID, userID string) (*WorkspaceMemberPO, error)
	ListMembers(workspaceID string) ([]*WorkspaceMemberPO, error)

	// CLI token management
	CreateCLIToken(ctx context.Context, token *WorkspaceCLIToken, tokenHash string) error
	GetCLITokenByHash(ctx context.Context, tokenHash string) (*WorkspaceCLIToken, error)
	ListCLITokens(ctx context.Context, workspaceID string) ([]*WorkspaceCLIToken, error)
	TouchCLIToken(ctx context.Context, id string, usedAt time.Time) error

	// Permission checks
	CheckPermission(workspaceID, userID string, isSuperAdmin bool) (string, error)
	HasPermission(workspaceID, userID string, requiredRole string, isSuperAdmin bool) (bool, error)
}

// repository implements Repository interface
type repository struct {
	db *gorm.DB
}

type WorkspaceStats struct {
	APISpecCount     int64 `json:"api_spec_count"`
	FlowCount        int64 `json:"flow_count"`
	EnvironmentCount int64 `json:"environment_count"`
	MemberCount      int64 `json:"member_count"`
	CategoryCount    int64 `json:"category_count"`
}

type workspaceDeleteStatement struct {
	table string
	sql   string
	args  []any
}

func workspaceDeleteStatements(workspaceID string) []workspaceDeleteStatement {
	flowIDsSubquery := "SELECT id FROM api_flows WHERE workspace_id = ?"
	flowRunIDsSubquery := "SELECT id FROM api_flow_runs WHERE flow_id IN (" + flowIDsSubquery + ")"

	return []workspaceDeleteStatement{
		{
			table: "api_flow_step_results",
			sql:   "DELETE FROM api_flow_step_results WHERE run_id IN (" + flowRunIDsSubquery + ")",
			args:  []any{workspaceID},
		},
		{
			table: "api_flow_runs",
			sql:   "DELETE FROM api_flow_runs WHERE flow_id IN (" + flowIDsSubquery + ")",
			args:  []any{workspaceID},
		},
		{
			table: "api_flow_edges",
			sql:   "DELETE FROM api_flow_edges WHERE flow_id IN (" + flowIDsSubquery + ")",
			args:  []any{workspaceID},
		},
		{
			table: "api_flow_steps",
			sql:   "DELETE FROM api_flow_steps WHERE flow_id IN (" + flowIDsSubquery + ")",
			args:  []any{workspaceID},
		},
		{table: "api_flows", sql: "DELETE FROM api_flows WHERE workspace_id = ?", args: []any{workspaceID}},
		{table: "audit_logs", sql: "DELETE FROM audit_logs WHERE workspace_id = ?", args: []any{workspaceID}},
		{table: "workspace_invitations", sql: "DELETE FROM workspace_invitations WHERE workspace_id = ?", args: []any{workspaceID}},
		{table: "workspace_members", sql: "DELETE FROM workspace_members WHERE workspace_id = ?", args: []any{workspaceID}},
	}
}

// NewRepository creates a new workspace repository
func NewRepository(db *gorm.DB) Repository {
	return &repository{db: db}
}

// Create creates a new workspace
func (r *repository) Create(workspace *WorkspacePO) error {
	return r.db.Create(workspace).Error
}

// Update updates an existing workspace
func (r *repository) Update(workspace *WorkspacePO) error {
	return r.db.Save(workspace).Error
}

// Delete soft deletes a workspace
func (r *repository) Delete(id string) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		for _, statement := range workspaceDeleteStatements(id) {
			if !tx.Migrator().HasTable(statement.table) {
				continue
			}

			if err := tx.Exec(statement.sql, statement.args...).Error; err != nil {
				return err
			}
		}

		return dbutil.DeleteByID(tx, &WorkspacePO{}, id).Error
	})
}

// FindByID finds a workspace by ID
func (r *repository) FindByID(id string) (*WorkspacePO, error) {
	var workspace WorkspacePO
	err := dbutil.ByID(r.db, id).First(&workspace).Error
	if err != nil {
		return nil, err
	}
	return &workspace, nil
}

// FindBySlug finds a workspace by slug
func (r *repository) FindBySlug(slug string) (*WorkspacePO, error) {
	var workspace WorkspacePO
	err := r.db.Where("slug = ?", slug).First(&workspace).Error
	if err != nil {
		return nil, err
	}
	return &workspace, nil
}

// FindByOwnerID finds all workspaces owned by a user
func (r *repository) FindByOwnerID(ownerID string) ([]*WorkspacePO, error) {
	var workspaces []*WorkspacePO
	err := r.db.Where("owner_id = ?", ownerID).Find(&workspaces).Error
	return workspaces, err
}

// ListByUserID lists all workspaces accessible to a user
// Super admins can see all workspaces
func (r *repository) ListByUserID(userID string, isSuperAdmin bool) ([]*WorkspacePO, error) {
	var workspaces []*WorkspacePO

	// Super admin can see everything
	if isSuperAdmin {
		err := r.db.Order("created_at DESC").Find(&workspaces).Error
		return workspaces, err
	}

	// Regular users see workspaces they are members of
	var rows []struct {
		WorkspacePO
		Role string
	}

	err := r.db.
		Model(&WorkspacePO{}).
		Select("workspaces.*, workspace_members.role AS role").
		Joins("JOIN workspace_members ON workspace_members.workspace_id = workspaces.id").
		Where("workspace_members.user_id = ?", userID).
		Where("workspace_members.deleted_at IS NULL").
		Order("workspaces.created_at DESC").
		Find(&rows).Error
	if err != nil {
		return nil, err
	}

	workspaces = make([]*WorkspacePO, len(rows))
	for index, row := range rows {
		workspace := row.WorkspacePO
		workspace.Role = row.Role
		workspaces[index] = &workspace
	}

	return workspaces, nil
}

func (r *repository) GetStats(ctx context.Context, workspaceID string) (*WorkspaceStats, error) {
	stats := &WorkspaceStats{}
	db := r.db.WithContext(ctx)

	db.Table("api_specs").Where("workspace_id = ?", workspaceID).Count(&stats.APISpecCount)
	db.Table("api_flows").Where("workspace_id = ?", workspaceID).Count(&stats.FlowCount)
	db.Table("environments").Where("workspace_id = ?", workspaceID).Count(&stats.EnvironmentCount)
	db.Table("workspace_members").Where("workspace_id = ?", workspaceID).Count(&stats.MemberCount)
	db.Table("api_categories").Where("workspace_id = ?", workspaceID).Count(&stats.CategoryCount)

	return stats, nil
}

// AddMember adds a member to a workspace
func (r *repository) AddMember(member *WorkspaceMemberPO) error {
	return r.db.Create(member).Error
}

// RemoveMember removes a member from a workspace
func (r *repository) RemoveMember(workspaceID, userID string) error {
	return r.db.
		Where("workspace_id = ? AND user_id = ?", workspaceID, userID).
		Delete(&WorkspaceMemberPO{}).Error
}

// UpdateMemberRole updates a member's role
func (r *repository) UpdateMemberRole(workspaceID, userID string, role string) error {
	return r.db.
		Model(&WorkspaceMemberPO{}).
		Where("workspace_id = ? AND user_id = ?", workspaceID, userID).
		Update("role", role).Error
}

// FindMember finds a specific workspace member
func (r *repository) FindMember(workspaceID, userID string) (*WorkspaceMemberPO, error) {
	var member WorkspaceMemberPO
	err := r.db.
		Where("workspace_id = ? AND user_id = ?", workspaceID, userID).
		First(&member).Error
	if err != nil {
		return nil, err
	}
	return &member, nil
}

// ListMembers lists all members of a workspace
func (r *repository) ListMembers(workspaceID string) ([]*WorkspaceMemberPO, error) {
	var members []*WorkspaceMemberPO
	err := r.db.
		Where("workspace_id = ?", workspaceID).
		Order("role DESC, joined_at ASC").
		Find(&members).Error
	return members, err
}

func (r *repository) CreateCLIToken(ctx context.Context, token *WorkspaceCLIToken, tokenHash string) error {
	po := newWorkspaceCLITokenPO(token, tokenHash)
	if err := r.db.WithContext(ctx).Create(po).Error; err != nil {
		return err
	}

	token.ID = po.ID
	token.CreatedAt = po.CreatedAt
	token.UpdatedAt = po.UpdatedAt
	return nil
}

func (r *repository) GetCLITokenByHash(ctx context.Context, tokenHash string) (*WorkspaceCLIToken, error) {
	var po WorkspaceCLITokenPO
	if err := r.db.WithContext(ctx).
		Where("token_hash = ?", tokenHash).
		First(&po).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}

	return po.toDomain(), nil
}

func (r *repository) ListCLITokens(ctx context.Context, workspaceID string) ([]*WorkspaceCLIToken, error) {
	var pos []*WorkspaceCLITokenPO
	if err := r.db.WithContext(ctx).
		Where("workspace_id = ?", workspaceID).
		Order("created_at DESC").
		Find(&pos).Error; err != nil {
		return nil, err
	}

	tokens := make([]*WorkspaceCLIToken, len(pos))
	for i, po := range pos {
		tokens[i] = po.toDomain()
	}
	return tokens, nil
}

func (r *repository) TouchCLIToken(ctx context.Context, id string, usedAt time.Time) error {
	return r.db.WithContext(ctx).
		Model(&WorkspaceCLITokenPO{}).
		Where("id = ?", id).
		Update("last_used_at", usedAt).Error
}

// CheckPermission returns the user's role in a workspace
// Super admins are treated as having owner role
func (r *repository) CheckPermission(workspaceID, userID string, isSuperAdmin bool) (string, error) {
	// Super admin has owner-level access everywhere
	if isSuperAdmin {
		return RoleOwner, nil
	}

	member, err := r.FindMember(workspaceID, userID)
	if err != nil {
		return "", err
	}
	return member.Role, nil
}

// HasPermission checks if a user has at least the required role level
// Super admins always have permission
func (r *repository) HasPermission(workspaceID, userID string, requiredRole string, isSuperAdmin bool) (bool, error) {
	// Super admin bypasses all permission checks
	if isSuperAdmin {
		return true, nil
	}

	userRole, err := r.CheckPermission(workspaceID, userID, false)
	if err != nil {
		return false, err
	}

	// Check role hierarchy
	return RoleLevel[userRole] >= RoleLevel[requiredRole], nil
}
