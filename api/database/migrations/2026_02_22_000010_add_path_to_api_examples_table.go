package migrations

import (
	"gorm.io/gorm"

	"github.com/kest-labs/kest/api/internal/infra/migration"
)

func init() {
	register("2026_02_22_000010_add_path_to_api_examples_table", &addPathToAPIExamplesTable{})
}

type addPathToAPIExamplesTable struct {
	migration.BaseMigration
}

func (m *addPathToAPIExamplesTable) Up(db *gorm.DB) error {
	return addColumnIfMissing(db, "api_examples", "path", "VARCHAR(500)")
}

func (m *addPathToAPIExamplesTable) Down(db *gorm.DB) error {
	return dropColumnIfExists(db, "api_examples", "path")
}
