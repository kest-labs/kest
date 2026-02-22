package migrations

import (
	"github.com/kest-labs/kest/api/internal/infra/migration"
	"gorm.io/gorm"
)

func init() {
	register("2026_02_22_000011_add_method_to_api_examples_table", &addMethodToAPIExamplesTable{})
}

type addMethodToAPIExamplesTable struct {
	migration.BaseMigration
}

func (m *addMethodToAPIExamplesTable) Up(db *gorm.DB) error {
	if err := db.Exec("ALTER TABLE api_examples ADD COLUMN IF NOT EXISTS path VARCHAR(500)").Error; err != nil {
		return err
	}
	return db.Exec("ALTER TABLE api_examples ADD COLUMN IF NOT EXISTS method VARCHAR(10)").Error
}

func (m *addMethodToAPIExamplesTable) Down(db *gorm.DB) error {
	if err := db.Exec("ALTER TABLE api_examples DROP COLUMN IF EXISTS method").Error; err != nil {
		return err
	}
	return db.Exec("ALTER TABLE api_examples DROP COLUMN IF EXISTS path").Error
}
