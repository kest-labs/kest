package migrations

import (
	"gorm.io/gorm"

	"github.com/kest-labs/kest/api/internal/infra/migration"
)

func init() {
	register("2026_05_18_000027_move_collections_to_workspaces", &moveCollectionsToWorkspaces{
		BaseMigration: migration.BaseMigration{
			UseTransaction: true,
		},
	})
}

type moveCollectionsToWorkspaces struct {
	migration.BaseMigration
}

func (m *moveCollectionsToWorkspaces) Up(db *gorm.DB) error {
	if !db.Migrator().HasTable("collections") {
		return nil
	}

	if db.Migrator().HasColumn("collections", "project_id") &&
		!db.Migrator().HasColumn("collections", "workspace_id") {
		return db.Migrator().RenameColumn("collections", "project_id", "workspace_id")
	}

	if !db.Migrator().HasColumn("collections", "workspace_id") {
		return db.Migrator().AddColumn(&collectionWorkspaceColumn{}, "WorkspaceID")
	}

	return nil
}

func (m *moveCollectionsToWorkspaces) Down(db *gorm.DB) error {
	if !db.Migrator().HasTable("collections") {
		return nil
	}

	if db.Migrator().HasColumn("collections", "workspace_id") &&
		!db.Migrator().HasColumn("collections", "project_id") {
		return db.Migrator().RenameColumn("collections", "workspace_id", "project_id")
	}

	return nil
}

type collectionWorkspaceColumn struct {
	WorkspaceID string `gorm:"not null;index:idx_collections_workspace"`
}

func (collectionWorkspaceColumn) TableName() string {
	return "collections"
}
