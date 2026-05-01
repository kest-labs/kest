package workspace

import (
	"github.com/kest-labs/kest/api/pkg/dbutil"
	"gorm.io/gorm"
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

	// Member management
	AddMember(member *WorkspaceMemberPO) error
	RemoveMember(workspaceID, userID string) error
	UpdateMemberRole(workspaceID, userID string, role string) error
	FindMember(workspaceID, userID string) (*WorkspaceMemberPO, error)
	ListMembers(workspaceID string) ([]*WorkspaceMemberPO, error)

	// Permission checks
	CheckPermission(workspaceID, userID string, isSuperAdmin bool) (string, error)
	HasPermission(workspaceID, userID string, requiredRole string, isSuperAdmin bool) (bool, error)
}

// repository implements Repository interface
type repository struct {
	db *gorm.DB
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
	return dbutil.DeleteByID(r.db, &WorkspacePO{}, id).Error
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
	err := r.db.
		Joins("JOIN workspace_members ON workspace_members.workspace_id = workspaces.id").
		Where("workspace_members.user_id = ?", userID).
		Order("workspaces.created_at DESC").
		Find(&workspaces).Error

	return workspaces, err
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
