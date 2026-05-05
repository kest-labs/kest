package migrations

import (
	"gorm.io/gorm"

	"github.com/kest-labs/kest/api/internal/infra/migration"
)

func init() {
	register("2026_02_23_000014_add_doc_fields_to_api_specs_table", &addDocFieldsToAPISpecsTable{})
}

type addDocFieldsToAPISpecsTable struct {
	migration.BaseMigration
}

func (m *addDocFieldsToAPISpecsTable) Up(db *gorm.DB) error {
	if err := addColumnIfMissing(db, "api_specs", "doc_markdown", "TEXT"); err != nil {
		return err
	}
	if err := addColumnIfMissing(db, "api_specs", "doc_source", "VARCHAR(20) DEFAULT 'manual'"); err != nil {
		return err
	}
	if err := addColumnIfMissing(db, "api_specs", "doc_updated_at", "TIMESTAMP NULL"); err != nil {
		return err
	}
	return nil
}

func (m *addDocFieldsToAPISpecsTable) Down(db *gorm.DB) error {
	if err := dropColumnIfExists(db, "api_specs", "doc_updated_at"); err != nil {
		return err
	}
	if err := dropColumnIfExists(db, "api_specs", "doc_source"); err != nil {
		return err
	}
	if err := dropColumnIfExists(db, "api_specs", "doc_markdown"); err != nil {
		return err
	}
	return nil
}
