package migrations

import (
	"github.com/kest-labs/kest/api/internal/infra/migration"
	"gorm.io/gorm"
)

func init() {
	register("2026_02_22_000010_add_path_to_api_examples_table", &addPathToAPIExamplesTable{})
}

type addPathToAPIExamplesTable struct {
	migration.BaseMigration
}

func (m *addPathToAPIExamplesTable) Up(db *gorm.DB) error {
	return db.Exec("ALTER TABLE api_examples ADD COLUMN IF NOT EXISTS path VARCHAR(500)").Error
}

func (m *addPathToAPIExamplesTable) Down(db *gorm.DB) error {
	return db.Exec("ALTER TABLE api_examples DROP COLUMN IF EXISTS path").Error
}
