package migrations

import (
	"errors"
	"fmt"
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
		return "", nil, nil
	}

	for _, member := range members {
		if member.Role == "owner" {
			return member.UserID, members, nil
		}
	}

	return members[0].UserID, members, nil
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
	for _, projectMember := range projectMembers {
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

	return nil
}
