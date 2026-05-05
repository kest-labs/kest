package migrations

import (
	"gorm.io/gorm"

	"github.com/kest-labs/kest/api/internal/infra/migration"
)

func init() {
	register("2026_03_01_000015_add_i18n_doc_fields_to_api_specs_table", &addI18nDocFieldsToAPISpecsTable{})
}

type addI18nDocFieldsToAPISpecsTable struct {
	migration.BaseMigration
}

func (m *addI18nDocFieldsToAPISpecsTable) Up(db *gorm.DB) error {
	if err := addColumnIfMissing(db, "api_specs", "doc_markdown_zh", "TEXT"); err != nil {
		return err
	}
	if err := addColumnIfMissing(db, "api_specs", "doc_markdown_en", "TEXT"); err != nil {
		return err
	}
	if err := addColumnIfMissing(db, "api_specs", "doc_updated_at_zh", "TIMESTAMP NULL"); err != nil {
		return err
	}
	if err := addColumnIfMissing(db, "api_specs", "doc_updated_at_en", "TIMESTAMP NULL"); err != nil {
		return err
	}
	return nil
}

func (m *addI18nDocFieldsToAPISpecsTable) Down(db *gorm.DB) error {
	if err := dropColumnIfExists(db, "api_specs", "doc_updated_at_en"); err != nil {
		return err
	}
	if err := dropColumnIfExists(db, "api_specs", "doc_updated_at_zh"); err != nil {
		return err
	}
	if err := dropColumnIfExists(db, "api_specs", "doc_markdown_en"); err != nil {
		return err
	}
	if err := dropColumnIfExists(db, "api_specs", "doc_markdown_zh"); err != nil {
		return err
	}
	return nil
}
