package migrations

import (
	"github.com/kest-labs/kest/api/internal/infra/migration"
	"gorm.io/gorm"
)

func init() {
	register("2026_02_23_000014_add_doc_fields_to_api_specs_table", &addDocFieldsToAPISpecsTable{})
}

type addDocFieldsToAPISpecsTable struct {
	migration.BaseMigration
}

func (m *addDocFieldsToAPISpecsTable) Up(db *gorm.DB) error {
	if err := db.Exec("ALTER TABLE api_specs ADD COLUMN IF NOT EXISTS doc_markdown TEXT").Error; err != nil {
		return err
	}
	if err := db.Exec("ALTER TABLE api_specs ADD COLUMN IF NOT EXISTS doc_source VARCHAR(20) DEFAULT 'manual'").Error; err != nil {
		return err
	}
	if err := db.Exec("ALTER TABLE api_specs ADD COLUMN IF NOT EXISTS doc_updated_at TIMESTAMP NULL").Error; err != nil {
		return err
	}
	return nil
}

func (m *addDocFieldsToAPISpecsTable) Down(db *gorm.DB) error {
	if err := db.Exec("ALTER TABLE api_specs DROP COLUMN IF EXISTS doc_updated_at").Error; err != nil {
		return err
	}
	if err := db.Exec("ALTER TABLE api_specs DROP COLUMN IF EXISTS doc_source").Error; err != nil {
		return err
	}
	if err := db.Exec("ALTER TABLE api_specs DROP COLUMN IF EXISTS doc_markdown").Error; err != nil {
		return err
	}
	return nil
}
