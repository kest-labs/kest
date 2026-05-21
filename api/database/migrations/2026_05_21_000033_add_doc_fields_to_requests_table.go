package migrations

import (
	"gorm.io/gorm"

	"github.com/kest-labs/kest/api/internal/infra/migration"
)

func init() {
	register("2026_05_21_000033_add_doc_fields_to_requests_table", &addDocFieldsToRequestsTable{})
}

type addDocFieldsToRequestsTable struct {
	migration.BaseMigration
}

func (m *addDocFieldsToRequestsTable) Up(db *gorm.DB) error {
	if err := addColumnIfMissing(db, "requests", "doc_markdown", "TEXT"); err != nil {
		return err
	}
	if err := addColumnIfMissing(db, "requests", "doc_markdown_zh", "TEXT"); err != nil {
		return err
	}
	if err := addColumnIfMissing(db, "requests", "doc_markdown_en", "TEXT"); err != nil {
		return err
	}
	if err := addColumnIfMissing(db, "requests", "doc_source", "VARCHAR(20) DEFAULT 'manual'"); err != nil {
		return err
	}
	if err := addColumnIfMissing(db, "requests", "doc_updated_at", "TIMESTAMP NULL"); err != nil {
		return err
	}
	if err := addColumnIfMissing(db, "requests", "doc_updated_at_zh", "TIMESTAMP NULL"); err != nil {
		return err
	}
	if err := addColumnIfMissing(db, "requests", "doc_updated_at_en", "TIMESTAMP NULL"); err != nil {
		return err
	}
	return nil
}

func (m *addDocFieldsToRequestsTable) Down(db *gorm.DB) error {
	if err := dropColumnIfExists(db, "requests", "doc_updated_at_en"); err != nil {
		return err
	}
	if err := dropColumnIfExists(db, "requests", "doc_updated_at_zh"); err != nil {
		return err
	}
	if err := dropColumnIfExists(db, "requests", "doc_updated_at"); err != nil {
		return err
	}
	if err := dropColumnIfExists(db, "requests", "doc_source"); err != nil {
		return err
	}
	if err := dropColumnIfExists(db, "requests", "doc_markdown_en"); err != nil {
		return err
	}
	if err := dropColumnIfExists(db, "requests", "doc_markdown_zh"); err != nil {
		return err
	}
	if err := dropColumnIfExists(db, "requests", "doc_markdown"); err != nil {
		return err
	}
	return nil
}
