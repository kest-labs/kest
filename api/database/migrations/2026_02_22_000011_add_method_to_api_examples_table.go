package migrations

import (
	"gorm.io/gorm"

	"github.com/kest-labs/kest/api/internal/infra/migration"
)

func init() {
	register("2026_02_22_000011_add_method_to_api_examples_table", &addMethodToAPIExamplesTable{})
}

type addMethodToAPIExamplesTable struct {
	migration.BaseMigration
}

func (m *addMethodToAPIExamplesTable) Up(db *gorm.DB) error {
	if err := addColumnIfMissing(db, "api_examples", "path", "VARCHAR(500)"); err != nil {
		return err
	}
	return addColumnIfMissing(db, "api_examples", "method", "VARCHAR(10)")
}

func (m *addMethodToAPIExamplesTable) Down(db *gorm.DB) error {
	if err := dropColumnIfExists(db, "api_examples", "method"); err != nil {
		return err
	}
	return dropColumnIfExists(db, "api_examples", "path")
}
