package migrations

import (
	"github.com/kest-labs/kest/api/internal/infra/migration"
	"github.com/kest-labs/kest/api/internal/modules/apispec"
	"gorm.io/gorm"
)

func init() {
	register("2026_02_22_000007_create_api_specs_tables", &createAPISpecsTables{})
}

type createAPISpecsTables struct {
	migration.BaseMigration
}

func (m *createAPISpecsTables) Up(db *gorm.DB) error {
	if err := db.AutoMigrate(&apispec.APISpecPO{}); err != nil {
		return err
	}
	return db.AutoMigrate(&apispec.APIExamplePO{})
}

func (m *createAPISpecsTables) Down(db *gorm.DB) error {
	if err := db.Migrator().DropTable("api_examples"); err != nil {
		return err
	}
	return db.Migrator().DropTable("api_specs")
}
