package migrations

import (
	"gorm.io/gorm"

	"github.com/kest-labs/kest/api/internal/infra/migration"
)

func init() {
	register("2026_05_21_000035_add_runtime_fields_to_workspaces", &addRuntimeFieldsToWorkspaces{})
}

type addRuntimeFieldsToWorkspaces struct {
	migration.BaseMigration
}

func (m *addRuntimeFieldsToWorkspaces) Up(db *gorm.DB) error {
	if err := addColumnIfMissing(db, "workspaces", "platform", "VARCHAR(50)"); err != nil {
		return err
	}
	if err := addColumnIfMissing(db, "workspaces", "public_key", "VARCHAR(64)"); err != nil {
		return err
	}
	if err := addColumnIfMissing(db, "workspaces", "status", "INTEGER DEFAULT 1"); err != nil {
		return err
	}
	return nil
}

func (m *addRuntimeFieldsToWorkspaces) Down(db *gorm.DB) error {
	if err := dropColumnIfExists(db, "workspaces", "status"); err != nil {
		return err
	}
	if err := dropColumnIfExists(db, "workspaces", "public_key"); err != nil {
		return err
	}
	if err := dropColumnIfExists(db, "workspaces", "platform"); err != nil {
		return err
	}
	return nil
}
