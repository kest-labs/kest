package migrations

import (
	"errors"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/gosimple/slug"
	"gorm.io/gorm"

	"github.com/kest-labs/kest/api/internal/infra/migration"
)

func init() {
	register("2026_05_21_000032_add_workspace_id_to_projects", &addWorkspaceIDToProjects{
		BaseMigration: migration.BaseMigration{
			UseTransaction: true,
		},
	})
}

type addWorkspaceIDToProjects struct {
	migration.BaseMigration
}

const (
	workspaceBackfillOwnerIDEnv        = "KEST_WORKSPACE_BACKFILL_OWNER_ID"
	workspaceBackfillOwnerEmailEnv     = "KEST_WORKSPACE_BACKFILL_OWNER_EMAIL"
	workspaceBackfillDefaultOwnerEmail = "admin@example.com"
)

func (m *addWorkspaceIDToProjects) Up(db *gorm.DB) error {
	if !db.Migrator().HasTable("projects") {
		return nil
	}

	if !db.Migrator().HasColumn("projects", "workspace_id") {
		if err := db.Migrator().AddColumn(&projectWorkspaceColumn{}, "WorkspaceID"); err != nil {
			return err
		}
	}

	if !db.Migrator().HasTable("workspaces") || !db.Migrator().HasTable("project_members") {
		return nil
	}

	return backfillProjectWorkspaceIDs(db)
}

func (m *addWorkspaceIDToProjects) Down(db *gorm.DB) error {
	if !db.Migrator().HasTable("projects") || !db.Migrator().HasColumn("projects", "workspace_id") {
		return nil
	}

	return db.Migrator().DropColumn(&projectWorkspaceColumn{}, "WorkspaceID")
}

type projectWorkspaceColumn struct {
	WorkspaceID string `gorm:"index"`
}

func (projectWorkspaceColumn) TableName() string {
	return "projects"
}

type migrationProject struct {
	ID          string  `gorm:"primaryKey"`
	WorkspaceID *string `gorm:"column:workspace_id"`
	Name        string
	Slug        string
}

func (migrationProject) TableName() string {
	return "projects"
}

type migrationProjectMember struct {
	ID        string         `gorm:"primaryKey"`
	ProjectID string         `gorm:"column:project_id"`
	UserID    string         `gorm:"column:user_id"`
	Role      string         `gorm:"column:role"`
	CreatedAt time.Time      `gorm:"column:created_at"`
	UpdatedAt time.Time      `gorm:"column:updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"column:deleted_at"`
}

func (migrationProjectMember) TableName() string {
	return "project_members"
}

type migrationWorkspace struct {
	ID          string `gorm:"primaryKey"`
	Name        string
	Slug        string
	Description string
	Type        string
	OwnerID     string `gorm:"column:owner_id"`
	Visibility  string
	CreatedAt   time.Time `gorm:"column:created_at"`
	UpdatedAt   time.Time `gorm:"column:updated_at"`
}

func (migrationWorkspace) TableName() string {
	return "workspaces"
}

type migrationWorkspaceMember struct {
	ID          string         `gorm:"primaryKey"`
	WorkspaceID string         `gorm:"column:workspace_id"`
	UserID      string         `gorm:"column:user_id"`
	Role        string         `gorm:"column:role"`
	InvitedBy   string         `gorm:"column:invited_by"`
	JoinedAt    time.Time      `gorm:"column:joined_at"`
	CreatedAt   time.Time      `gorm:"column:created_at"`
	UpdatedAt   time.Time      `gorm:"column:updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"column:deleted_at"`
}

func (migrationWorkspaceMember) TableName() string {
	return "workspace_members"
}

type migrationUser struct {
	ID        string    `gorm:"primaryKey"`
	CreatedAt time.Time `gorm:"column:created_at"`
	Email     string    `gorm:"column:email"`
}

func (migrationUser) TableName() string {
	return "users"
}

func backfillProjectWorkspaceIDs(db *gorm.DB) error {
	var projects []migrationProject
	if err := db.Where("workspace_id IS NULL OR workspace_id = ''").Find(&projects).Error; err != nil {
		return err
	}

	for _, project := range projects {
		ownerID, members, err := loadProjectMembersForWorkspaceBackfill(db, project.ID)
		if err != nil {
			return err
		}
		if ownerID == "" {
			return fmt.Errorf("project %s does not have an owner/member to derive workspace ownership", project.ID)
		}

		projectWorkspace, err := resolveWorkspaceForProject(db, project, ownerID)
		if err != nil {
			return err
		}

		if err := db.Model(&migrationProject{}).
			Where("id = ?", project.ID).
			Update("workspace_id", projectWorkspace.ID).Error; err != nil {
			return err
		}

		if err := syncWorkspaceMembersFromProject(db, projectWorkspace.ID, ownerID, members); err != nil {
			return err
		}
	}

	return nil
}

func loadProjectMembersForWorkspaceBackfill(db *gorm.DB, projectID string) (string, []migrationProjectMember, error) {
	var members []migrationProjectMember
	if err := db.
		Where("project_id = ? AND deleted_at IS NULL", projectID).
		Order("created_at ASC").
		Find(&members).Error; err != nil {
		return "", nil, err
	}

	if len(members) == 0 {
		ownerID, err := workspaceBackfillFallbackUserID(db)
		return ownerID, members, err
	}

	for _, member := range members {
		if member.Role == "owner" {
			return member.UserID, members, nil
		}
	}

	return members[0].UserID, members, nil
}

func workspaceBackfillFallbackUserID(db *gorm.DB) (string, error) {
	if !db.Migrator().HasTable("users") {
		return "", fmt.Errorf("workspace ownership cannot be derived because users table is missing")
	}

	if ownerID := strings.TrimSpace(os.Getenv(workspaceBackfillOwnerIDEnv)); ownerID != "" {
		userID, err := findWorkspaceBackfillUserID(db, "id", ownerID)
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return "", fmt.Errorf("workspace ownership cannot use %s=%q because no active user matches", workspaceBackfillOwnerIDEnv, ownerID)
		}
		return userID, err
	}

	if ownerEmail := strings.TrimSpace(os.Getenv(workspaceBackfillOwnerEmailEnv)); ownerEmail != "" {
		userID, err := findWorkspaceBackfillUserID(db, "email", ownerEmail)
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return "", fmt.Errorf("workspace ownership cannot use %s=%q because no active user matches", workspaceBackfillOwnerEmailEnv, ownerEmail)
		}
		return userID, err
	}

	if db.Migrator().HasColumn("users", "email") {
		ownerID, err := findWorkspaceBackfillUserID(db, "email", workspaceBackfillDefaultOwnerEmail)
		if err == nil {
			return ownerID, nil
		}
		if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			return "", err
		}
	}

	var users []migrationUser
	if err := activeWorkspaceBackfillUsersQuery(db).Order("created_at ASC, id ASC").Limit(2).Find(&users).Error; err != nil {
		return "", err
	}

	switch len(users) {
	case 1:
		return users[0].ID, nil
	case 0:
		return "", fmt.Errorf("workspace ownership cannot be derived because no active users exist")
	default:
		return "", fmt.Errorf("workspace ownership cannot be derived automatically because multiple active users exist and no default admin user was found; set %s or %s before rerunning migrations", workspaceBackfillOwnerIDEnv, workspaceBackfillOwnerEmailEnv)
	}
}

func findWorkspaceBackfillUserID(db *gorm.DB, column string, value string) (string, error) {
	if !db.Migrator().HasColumn("users", column) {
		return "", fmt.Errorf("workspace ownership cannot use users.%s because the column is missing", column)
	}

	var user migrationUser
	err := activeWorkspaceBackfillUsersQuery(db).
		Where(column+" = ?", value).
		Order("created_at ASC, id ASC").
		First(&user).Error
	if err != nil {
		return "", err
	}

	return user.ID, nil
}

func activeWorkspaceBackfillUsersQuery(db *gorm.DB) *gorm.DB {
	query := db.Model(&migrationUser{})
	if db.Migrator().HasColumn("users", "deleted_at") {
		query = query.Where("deleted_at IS NULL")
	}

	return query
}

func resolveWorkspaceForProject(
	db *gorm.DB,
	project migrationProject,
	ownerID string,
) (*migrationWorkspace, error) {
	projectWorkspace, err := findWorkspaceByOwnerAndSlug(db, ownerID, project.Slug)
	if err == nil {
		return projectWorkspace, nil
	}
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	projectWorkspace, err = findWorkspaceByOwnerAndName(db, ownerID, project.Name)
	if err == nil {
		return projectWorkspace, nil
	}
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	return createWorkspaceForProjectMigration(db, project, ownerID)
}

func findWorkspaceByOwnerAndSlug(db *gorm.DB, ownerID string, projectSlug string) (*migrationWorkspace, error) {
	var workspace migrationWorkspace
	err := db.Where("owner_id = ? AND slug = ?", ownerID, projectSlug).First(&workspace).Error
	if err != nil {
		return nil, err
	}
	return &workspace, nil
}

func findWorkspaceByOwnerAndName(db *gorm.DB, ownerID string, projectName string) (*migrationWorkspace, error) {
	var workspace migrationWorkspace
	err := db.Where("owner_id = ? AND name = ?", ownerID, projectName).Order("created_at ASC").First(&workspace).Error
	if err != nil {
		return nil, err
	}
	return &workspace, nil
}

func createWorkspaceForProjectMigration(
	db *gorm.DB,
	project migrationProject,
	ownerID string,
) (*migrationWorkspace, error) {
	now := time.Now()
	projectWorkspace := &migrationWorkspace{
		Name:       project.Name,
		Slug:       uniqueWorkspaceSlugForProject(db, project),
		Type:       "personal",
		OwnerID:    ownerID,
		Visibility: "private",
		CreatedAt:  now,
		UpdatedAt:  now,
	}

	if err := db.Create(projectWorkspace).Error; err != nil {
		return nil, err
	}

	ownerMembership := &migrationWorkspaceMember{
		WorkspaceID: projectWorkspace.ID,
		UserID:      ownerID,
		Role:        "owner",
		InvitedBy:   ownerID,
		JoinedAt:    now,
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	if err := db.Create(ownerMembership).Error; err != nil {
		return nil, err
	}

	return projectWorkspace, nil
}

func uniqueWorkspaceSlugForProject(db *gorm.DB, project migrationProject) string {
	baseSlug := strings.Trim(project.Slug, "-")
	if baseSlug == "" {
		baseSlug = slug.Make(project.Name)
	}
	if baseSlug == "" {
		baseSlug = fmt.Sprintf("project-%s", shortProjectID(project.ID))
	}

	candidate := baseSlug
	for attempt := 0; attempt < 10; attempt++ {
		var count int64
		if err := db.Model(&migrationWorkspace{}).Where("slug = ?", candidate).Count(&count).Error; err == nil && count == 0 {
			return candidate
		}

		suffix := fmt.Sprintf("-%d", attempt+2)
		maxBaseLength := 50 - len(suffix)
		trimmedBase := baseSlug
		if len(trimmedBase) > maxBaseLength {
			trimmedBase = strings.Trim(trimmedBase[:maxBaseLength], "-")
		}
		if trimmedBase == "" {
			trimmedBase = "project"
		}
		candidate = trimmedBase + suffix
	}

	suffix := "-" + shortProjectID(project.ID)
	maxBaseLength := 50 - len(suffix)
	trimmedBase := baseSlug
	if len(trimmedBase) > maxBaseLength {
		trimmedBase = strings.Trim(trimmedBase[:maxBaseLength], "-")
	}
	if trimmedBase == "" {
		trimmedBase = "project"
	}

	return trimmedBase + suffix
}

func shortProjectID(projectID string) string {
	trimmed := strings.ReplaceAll(projectID, "-", "")
	if len(trimmed) <= 8 {
		return trimmed
	}
	return trimmed[:8]
}

func syncWorkspaceMembersFromProject(
	db *gorm.DB,
	workspaceID string,
	ownerID string,
	projectMembers []migrationProjectMember,
) error {
	if !db.Migrator().HasTable("workspace_members") {
		return nil
	}

	now := time.Now()
	hasMembers := false
	for _, projectMember := range projectMembers {
		hasMembers = true
		var workspaceMember migrationWorkspaceMember
		err := db.Unscoped().
			Where("workspace_id = ? AND user_id = ?", workspaceID, projectMember.UserID).
			First(&workspaceMember).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			nextMember := &migrationWorkspaceMember{
				WorkspaceID: workspaceID,
				UserID:      projectMember.UserID,
				Role:        projectMember.Role,
				InvitedBy:   ownerID,
				JoinedAt:    now,
				CreatedAt:   now,
				UpdatedAt:   now,
			}
			if err := db.Create(nextMember).Error; err != nil {
				return err
			}
			continue
		}
		if err != nil {
			return err
		}

		updates := map[string]any{
			"role":       projectMember.Role,
			"invited_by": ownerID,
			"updated_at": now,
		}
		if workspaceMember.JoinedAt.IsZero() {
			updates["joined_at"] = now
		}
		if workspaceMember.DeletedAt.Valid {
			updates["deleted_at"] = nil
		}

		if err := db.Unscoped().
			Model(&migrationWorkspaceMember{}).
			Where("id = ?", workspaceMember.ID).
			Updates(updates).Error; err != nil {
			return err
		}
	}

	if !hasMembers && ownerID != "" {
		return ensureWorkspaceOwnerMember(db, workspaceID, ownerID)
	}

	return nil
}

func ensureWorkspaceOwnerMember(db *gorm.DB, workspaceID string, ownerID string) error {
	now := time.Now()
	var workspaceMember migrationWorkspaceMember
	err := db.Unscoped().
		Where("workspace_id = ? AND user_id = ?", workspaceID, ownerID).
		First(&workspaceMember).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return db.Create(&migrationWorkspaceMember{
			WorkspaceID: workspaceID,
			UserID:      ownerID,
			Role:        "owner",
			InvitedBy:   ownerID,
			JoinedAt:    now,
			CreatedAt:   now,
			UpdatedAt:   now,
		}).Error
	}
	if err != nil {
		return err
	}

	updates := map[string]any{
		"role":       "owner",
		"invited_by": ownerID,
		"updated_at": now,
	}
	if workspaceMember.JoinedAt.IsZero() {
		updates["joined_at"] = now
	}
	if workspaceMember.DeletedAt.Valid {
		updates["deleted_at"] = nil
	}

	return db.Unscoped().
		Model(&migrationWorkspaceMember{}).
		Where("id = ?", workspaceMember.ID).
		Updates(updates).Error
}
