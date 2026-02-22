package migrations

import (
	"github.com/kest-labs/kest/api/internal/infra/migration"
	"github.com/kest-labs/kest/api/internal/modules/example"
	"gorm.io/gorm"
)

func init() {
	register("2026_02_22_000002_create_examples_table", &createExamplesTable{})
}

type createExamplesTable struct {
	migration.BaseMigration
}

func (m *createExamplesTable) Up(db *gorm.DB) error {
	return db.AutoMigrate(&example.ExamplePO{})
}

func (m *createExamplesTable) Down(db *gorm.DB) error {
	return db.Migrator().DropTable("examples")
}
