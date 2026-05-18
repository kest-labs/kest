package migrations

import (
	"gorm.io/gorm"

	"github.com/kest-labs/kest/api/internal/infra/migration"
)

func init() {
	register("2026_05_18_000028_move_history_to_workspaces", &moveHistoryToWorkspaces{
		BaseMigration: migration.BaseMigration{
			UseTransaction: true,
		},
	})
}

type moveHistoryToWorkspaces struct {
	migration.BaseMigration
}

func (m *moveHistoryToWorkspaces) Up(db *gorm.DB) error {
	if !db.Migrator().HasTable("history") {
		return nil
	}

	if err := db.Exec(`DROP INDEX IF EXISTS idx_history_project_source_event`).Error; err != nil {
		return err
	}

	if db.Migrator().HasColumn("history", "project_id") &&
		!db.Migrator().HasColumn("history", "workspace_id") {
		if err := db.Migrator().RenameColumn("history", "project_id", "workspace_id"); err != nil {
			return err
		}
	}

	if !db.Migrator().HasColumn("history", "workspace_id") {
		if err := db.Migrator().AddColumn(&historyWorkspaceColumn{}, "WorkspaceID"); err != nil {
			return err
		}
	}

	return db.Exec(`
		CREATE UNIQUE INDEX IF NOT EXISTS idx_history_workspace_source_event
		    ON history(workspace_id, source, source_event_id)
	`).Error
}

func (m *moveHistoryToWorkspaces) Down(db *gorm.DB) error {
	if !db.Migrator().HasTable("history") {
		return nil
	}

	if err := db.Exec(`DROP INDEX IF EXISTS idx_history_workspace_source_event`).Error; err != nil {
		return err
	}

	if db.Migrator().HasColumn("history", "workspace_id") &&
		!db.Migrator().HasColumn("history", "project_id") {
		if err := db.Migrator().RenameColumn("history", "workspace_id", "project_id"); err != nil {
			return err
		}
	}

	return db.Exec(`
		CREATE UNIQUE INDEX IF NOT EXISTS idx_history_project_source_event
		    ON history(project_id, source, source_event_id)
	`).Error
}

type historyWorkspaceColumn struct {
	WorkspaceID string `gorm:"not null;index:idx_history_workspace"`
}

func (historyWorkspaceColumn) TableName() string {
	return "history"
}
