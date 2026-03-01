package migrations

import (
	"github.com/kest-labs/kest/api/internal/infra/migration"
	"gorm.io/gorm"
)

func init() {
	register("2026_03_01_000015_add_i18n_doc_fields_to_api_specs_table", &addI18nDocFieldsToAPISpecsTable{})
}

type addI18nDocFieldsToAPISpecsTable struct {
	migration.BaseMigration
}

func (m *addI18nDocFieldsToAPISpecsTable) Up(db *gorm.DB) error {
	if err := db.Exec("ALTER TABLE api_specs ADD COLUMN IF NOT EXISTS doc_markdown_zh TEXT").Error; err != nil {
		return err
	}
	if err := db.Exec("ALTER TABLE api_specs ADD COLUMN IF NOT EXISTS doc_markdown_en TEXT").Error; err != nil {
		return err
	}
	if err := db.Exec("ALTER TABLE api_specs ADD COLUMN IF NOT EXISTS doc_updated_at_zh TIMESTAMP NULL").Error; err != nil {
		return err
	}
	if err := db.Exec("ALTER TABLE api_specs ADD COLUMN IF NOT EXISTS doc_updated_at_en TIMESTAMP NULL").Error; err != nil {
		return err
	}
	return nil
}

func (m *addI18nDocFieldsToAPISpecsTable) Down(db *gorm.DB) error {
	if err := db.Exec("ALTER TABLE api_specs DROP COLUMN IF EXISTS doc_updated_at_en").Error; err != nil {
		return err
	}
	if err := db.Exec("ALTER TABLE api_specs DROP COLUMN IF EXISTS doc_updated_at_zh").Error; err != nil {
		return err
	}
	if err := db.Exec("ALTER TABLE api_specs DROP COLUMN IF EXISTS doc_markdown_en").Error; err != nil {
		return err
	}
	if err := db.Exec("ALTER TABLE api_specs DROP COLUMN IF EXISTS doc_markdown_zh").Error; err != nil {
		return err
	}
	return nil
}
