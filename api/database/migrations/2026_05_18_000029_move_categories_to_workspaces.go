package migrations

import (
	"gorm.io/gorm"

	"github.com/kest-labs/kest/api/internal/infra/migration"
)

func init() {
	register("2026_05_18_000029_move_categories_to_workspaces", &moveCategoriesToWorkspaces{
		BaseMigration: migration.BaseMigration{
			UseTransaction: true,
		},
	})
}

type moveCategoriesToWorkspaces struct {
	migration.BaseMigration
}

func (m *moveCategoriesToWorkspaces) Up(db *gorm.DB) error {
	if !db.Migrator().HasTable("api_categories") {
		return nil
	}

	if db.Migrator().HasColumn("api_categories", "project_id") &&
		!db.Migrator().HasColumn("api_categories", "workspace_id") {
		return db.Migrator().RenameColumn("api_categories", "project_id", "workspace_id")
	}

	if !db.Migrator().HasColumn("api_categories", "workspace_id") {
		return db.Migrator().AddColumn(&categoryWorkspaceColumn{}, "WorkspaceID")
	}

	return nil
}

func (m *moveCategoriesToWorkspaces) Down(db *gorm.DB) error {
	if !db.Migrator().HasTable("api_categories") {
		return nil
	}

	if db.Migrator().HasColumn("api_categories", "workspace_id") &&
		!db.Migrator().HasColumn("api_categories", "project_id") {
		return db.Migrator().RenameColumn("api_categories", "workspace_id", "project_id")
	}

	return nil
}

type categoryWorkspaceColumn struct {
	WorkspaceID string `gorm:"not null;index:idx_categories_workspace"`
}

func (categoryWorkspaceColumn) TableName() string {
	return "api_categories"
}
