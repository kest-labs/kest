package migrations

import (
	"gorm.io/gorm"

	"github.com/kest-labs/kest/api/internal/infra/migration"
)

func init() {
	register("2026_02_22_000012_add_description_to_api_examples_table", &addDescriptionToAPIExamplesTable{})
}

type addDescriptionToAPIExamplesTable struct {
	migration.BaseMigration
}

func (m *addDescriptionToAPIExamplesTable) Up(db *gorm.DB) error {
	return addColumnIfMissing(db, "api_examples", "description", "TEXT")
}

func (m *addDescriptionToAPIExamplesTable) Down(db *gorm.DB) error {
	return dropColumnIfExists(db, "api_examples", "description")
}
