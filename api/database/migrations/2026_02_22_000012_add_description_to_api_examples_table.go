package migrations

import (
	"github.com/kest-labs/kest/api/internal/infra/migration"
	"gorm.io/gorm"
)

func init() {
	register("2026_02_22_000012_add_description_to_api_examples_table", &addDescriptionToAPIExamplesTable{})
}

type addDescriptionToAPIExamplesTable struct {
	migration.BaseMigration
}

func (m *addDescriptionToAPIExamplesTable) Up(db *gorm.DB) error {
	return db.Exec("ALTER TABLE api_examples ADD COLUMN IF NOT EXISTS description TEXT").Error
}

func (m *addDescriptionToAPIExamplesTable) Down(db *gorm.DB) error {
	return db.Exec("ALTER TABLE api_examples DROP COLUMN IF EXISTS description").Error
}
