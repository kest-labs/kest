package migrations

import (
	"gorm.io/gorm"

	"github.com/kest-labs/kest/api/internal/infra/migration"
)

func init() {
	register("2026_05_18_000026_move_environments_to_workspaces", &moveEnvironmentsToWorkspaces{
		BaseMigration: migration.BaseMigration{
			UseTransaction: true,
		},
	})
}

type moveEnvironmentsToWorkspaces struct {
	migration.BaseMigration
}

func (m *moveEnvironmentsToWorkspaces) Up(db *gorm.DB) error {
	if !db.Migrator().HasTable("environments") {
		return nil
	}

	if db.Migrator().HasColumn("environments", "project_id") &&
		!db.Migrator().HasColumn("environments", "workspace_id") {
		return db.Migrator().RenameColumn("environments", "project_id", "workspace_id")
	}

	if !db.Migrator().HasColumn("environments", "workspace_id") {
		return db.Migrator().AddColumn(&environmentWorkspaceColumn{}, "WorkspaceID")
	}

	return nil
}

func (m *moveEnvironmentsToWorkspaces) Down(db *gorm.DB) error {
	if !db.Migrator().HasTable("environments") {
		return nil
	}

	if db.Migrator().HasColumn("environments", "workspace_id") &&
		!db.Migrator().HasColumn("environments", "project_id") {
		return db.Migrator().RenameColumn("environments", "workspace_id", "project_id")
	}

	return nil
}

type environmentWorkspaceColumn struct {
	WorkspaceID string `gorm:"not null;index:idx_env_workspace"`
}

func (environmentWorkspaceColumn) TableName() string {
	return "environments"
}
