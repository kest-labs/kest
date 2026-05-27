package migrations

import (
	"gorm.io/gorm"

	"github.com/kest-labs/kest/api/internal/infra/migration"
)

func init() {
	register("2026_05_18_000030_move_api_specs_to_workspaces", &moveAPISpecsToWorkspaces{
		BaseMigration: migration.BaseMigration{
			UseTransaction: true,
		},
	})
}

type moveAPISpecsToWorkspaces struct {
	migration.BaseMigration
}

func (m *moveAPISpecsToWorkspaces) Up(db *gorm.DB) error {
	for _, table := range []string{"api_specs", "api_spec_shares", "api_spec_ai_drafts"} {
		if err := renameProjectColumnToWorkspace(db, table); err != nil {
			return err
		}
	}

	return nil
}

func (m *moveAPISpecsToWorkspaces) Down(db *gorm.DB) error {
	for _, table := range []string{"api_specs", "api_spec_shares", "api_spec_ai_drafts"} {
		if err := renameWorkspaceColumnToProject(db, table); err != nil {
			return err
		}
	}

	return nil
}

func renameProjectColumnToWorkspace(db *gorm.DB, table string) error {
	if !db.Migrator().HasTable(table) {
		return nil
	}

	if db.Migrator().HasColumn(table, "project_id") &&
		!db.Migrator().HasColumn(table, "workspace_id") {
		return db.Migrator().RenameColumn(table, "project_id", "workspace_id")
	}

	if !db.Migrator().HasColumn(table, "workspace_id") {
		return addAPISpecWorkspaceColumn(db, table)
	}

	return nil
}

func renameWorkspaceColumnToProject(db *gorm.DB, table string) error {
	if !db.Migrator().HasTable(table) {
		return nil
	}

	if db.Migrator().HasColumn(table, "workspace_id") &&
		!db.Migrator().HasColumn(table, "project_id") {
		return db.Migrator().RenameColumn(table, "workspace_id", "project_id")
	}

	return nil
}

func addAPISpecWorkspaceColumn(db *gorm.DB, table string) error {
	switch table {
	case "api_specs":
		return db.Migrator().AddColumn(&apiSpecsWorkspaceColumn{}, "WorkspaceID")
	case "api_spec_shares":
		return db.Migrator().AddColumn(&apiSpecSharesWorkspaceColumn{}, "WorkspaceID")
	case "api_spec_ai_drafts":
		return db.Migrator().AddColumn(&apiSpecAIDraftsWorkspaceColumn{}, "WorkspaceID")
	default:
		return nil
	}
}

type apiSpecsWorkspaceColumn struct {
	WorkspaceID string `gorm:"not null;index"`
}

func (apiSpecsWorkspaceColumn) TableName() string {
	return "api_specs"
}

type apiSpecSharesWorkspaceColumn struct {
	WorkspaceID string `gorm:"not null;index"`
}

func (apiSpecSharesWorkspaceColumn) TableName() string {
	return "api_spec_shares"
}

type apiSpecAIDraftsWorkspaceColumn struct {
	WorkspaceID string `gorm:"not null;index"`
}

func (apiSpecAIDraftsWorkspaceColumn) TableName() string {
	return "api_spec_ai_drafts"
}
