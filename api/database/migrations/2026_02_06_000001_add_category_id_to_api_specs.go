package migrations

import (
	"github.com/kest-labs/kest/api/internal/infra/migration"
	"gorm.io/gorm"
)

func init() {
	register("2026_02_06_000001_add_category_id_to_api_specs", &addCategoryIDToApiSpecs{})
}

type addCategoryIDToApiSpecs struct {
	migration.BaseMigration
}

func (m *addCategoryIDToApiSpecs) Up(db *gorm.DB) error {
	if !db.Migrator().HasTable("api_specs") {
		return nil
	}

	// Add category_id column if it doesn't exist
	if !db.Migrator().HasColumn("api_specs", "category_id") {
		return db.Exec("ALTER TABLE api_specs ADD COLUMN category_id BIGINT").Error
	}
	return nil
}

func (m *addCategoryIDToApiSpecs) Down(db *gorm.DB) error {
	if !db.Migrator().HasTable("api_specs") {
		return nil
	}

	if db.Migrator().HasColumn("api_specs", "category_id") {
		return db.Exec("ALTER TABLE api_specs DROP COLUMN category_id").Error
	}
	return nil
}
