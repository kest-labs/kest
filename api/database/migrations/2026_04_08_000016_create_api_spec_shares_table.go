package migrations

import (
	"gorm.io/gorm"

	"github.com/kest-labs/kest/api/internal/infra/migration"
	"github.com/kest-labs/kest/api/internal/modules/apispec"
)

func init() {
	register("2026_04_08_000016_create_api_spec_shares_table", &createAPISpecSharesTable{})
}

type createAPISpecSharesTable struct {
	migration.BaseMigration
}

func (m *createAPISpecSharesTable) Up(db *gorm.DB) error {
	return db.AutoMigrate(&apispec.APISpecSharePO{})
}

func (m *createAPISpecSharesTable) Down(db *gorm.DB) error {
	return db.Migrator().DropTable("api_spec_shares")
}
