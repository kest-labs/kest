package migrations

import (
	"time"

	"gorm.io/gorm"

	"github.com/kest-labs/kest/api/internal/infra/migration"
)

func init() {
	register("2026_05_21_000034_move_project_runtime_tables_to_workspaces", &moveProjectRuntimeTablesToWorkspaces{
		BaseMigration: migration.BaseMigration{
			UseTransaction: true,
		},
	})
}

type moveProjectRuntimeTablesToWorkspaces struct {
	migration.BaseMigration
}

func (m *moveProjectRuntimeTablesToWorkspaces) Up(db *gorm.DB) error {
	if err := moveProjectRuntimeColumnToWorkspace(db, "api_flows", &apiFlowWorkspaceColumn{}, "WorkspaceID"); err != nil {
		return err
	}
	if err := moveProjectRuntimeColumnToWorkspace(db, "audit_logs", &auditLogWorkspaceColumn{}, "WorkspaceID"); err != nil {
		return err
	}
	if err := moveWorkspaceInvitationsTable(db); err != nil {
		return err
	}
	return moveProjectRuntimeColumnToWorkspace(db, "workspace_invitations", &workspaceInvitationWorkspaceColumn{}, "WorkspaceID")
}

func (m *moveProjectRuntimeTablesToWorkspaces) Down(db *gorm.DB) error {
	if err := moveWorkspaceRuntimeColumnToProject(db, "api_flows"); err != nil {
		return err
	}
	if err := moveWorkspaceRuntimeColumnToProject(db, "audit_logs"); err != nil {
		return err
	}
	if err := moveWorkspaceRuntimeColumnToProject(db, "workspace_invitations"); err != nil {
		return err
	}

	if db.Migrator().HasTable("workspace_invitations") && !db.Migrator().HasTable("project_invitations") {
		return db.Migrator().RenameTable("workspace_invitations", "project_invitations")
	}
	return nil
}

func moveWorkspaceInvitationsTable(db *gorm.DB) error {
	if db.Migrator().HasTable("workspace_invitations") {
		return nil
	}

	if db.Migrator().HasTable("project_invitations") {
		return db.Migrator().RenameTable("project_invitations", "workspace_invitations")
	}

	return db.AutoMigrate(&workspaceInvitationMigrationPO{})
}

func moveProjectRuntimeColumnToWorkspace(db *gorm.DB, table string, model any, field string) error {
	if !db.Migrator().HasTable(table) {
		return nil
	}

	if db.Migrator().HasColumn(table, "project_id") && !db.Migrator().HasColumn(table, "workspace_id") {
		return db.Migrator().RenameColumn(table, "project_id", "workspace_id")
	}

	if !db.Migrator().HasColumn(table, "workspace_id") {
		if err := db.Migrator().AddColumn(model, field); err != nil {
			return err
		}
	}

	if db.Migrator().HasColumn(table, "project_id") {
		if err := db.Exec("UPDATE " + table + " SET workspace_id = project_id WHERE (workspace_id IS NULL OR workspace_id = '') AND project_id IS NOT NULL AND project_id <> ''").Error; err != nil {
			return err
		}
		return db.Migrator().DropColumn(table, "project_id")
	}

	return nil
}

func moveWorkspaceRuntimeColumnToProject(db *gorm.DB, table string) error {
	if !db.Migrator().HasTable(table) {
		return nil
	}

	if db.Migrator().HasColumn(table, "workspace_id") && !db.Migrator().HasColumn(table, "project_id") {
		return db.Migrator().RenameColumn(table, "workspace_id", "project_id")
	}

	return nil
}

type apiFlowWorkspaceColumn struct {
	WorkspaceID string `gorm:"not null;index"`
}

func (apiFlowWorkspaceColumn) TableName() string {
	return "api_flows"
}

type auditLogWorkspaceColumn struct {
	WorkspaceID string `gorm:"index;default:0"`
}

func (auditLogWorkspaceColumn) TableName() string {
	return "audit_logs"
}

type workspaceInvitationWorkspaceColumn struct {
	WorkspaceID string `gorm:"not null;index"`
}

func (workspaceInvitationWorkspaceColumn) TableName() string {
	return "workspace_invitations"
}

type workspaceInvitationMigrationPO struct {
	ID            string `gorm:"primaryKey"`
	CreatedAt     time.Time
	UpdatedAt     time.Time
	DeletedAt     gorm.DeletedAt `gorm:"index"`
	WorkspaceID   string         `gorm:"not null;index"`
	TokenHash     string         `gorm:"size:64;not null;uniqueIndex"`
	TokenPrefix   string         `gorm:"size:32;not null;index"`
	Slug          string         `gorm:"size:64;not null;uniqueIndex"`
	Role          string         `gorm:"size:20;not null"`
	CreatedBy     string         `gorm:"not null;index"`
	InvitedUserID *string        `gorm:"index"`
	Status        string         `gorm:"size:20;not null;index"`
	MaxUses       int            `gorm:"not null;default:1"`
	UsedCount     int            `gorm:"not null;default:0"`
	ExpiresAt     *time.Time
	LastUsedAt    *time.Time
}

func (workspaceInvitationMigrationPO) TableName() string {
	return "workspace_invitations"
}
