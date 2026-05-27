package migrations

import (
	"gorm.io/gorm"

	"github.com/kest-labs/kest/api/internal/infra/migration"
)

func init() {
	register("2026_05_19_000032_move_flows_to_workspaces", &moveFlowsToWorkspaces{
		BaseMigration: migration.BaseMigration{
			UseTransaction: true,
		},
	})
}

type moveFlowsToWorkspaces struct {
	migration.BaseMigration
}

func (m *moveFlowsToWorkspaces) Up(db *gorm.DB) error {
	if !db.Migrator().HasTable("api_flows") {
		return nil
	}

	if db.Migrator().HasColumn("api_flows", "project_id") &&
		!db.Migrator().HasColumn("api_flows", "workspace_id") {
		return db.Migrator().RenameColumn("api_flows", "project_id", "workspace_id")
	}

	if !db.Migrator().HasColumn("api_flows", "workspace_id") {
		return db.Migrator().AddColumn(&flowWorkspaceColumn{}, "WorkspaceID")
	}

	return nil
}

func (m *moveFlowsToWorkspaces) Down(db *gorm.DB) error {
	if !db.Migrator().HasTable("api_flows") {
		return nil
	}

	if db.Migrator().HasColumn("api_flows", "workspace_id") &&
		!db.Migrator().HasColumn("api_flows", "project_id") {
		return db.Migrator().RenameColumn("api_flows", "workspace_id", "project_id")
	}

	return nil
}

type flowWorkspaceColumn struct {
	WorkspaceID string `gorm:"not null;index:idx_flows_workspace"`
}

func (flowWorkspaceColumn) TableName() string {
	return "api_flows"
}
