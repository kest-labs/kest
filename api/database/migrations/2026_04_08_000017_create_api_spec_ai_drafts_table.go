package migrations

import (
	"gorm.io/gorm"

	"github.com/kest-labs/kest/api/internal/infra/migration"
	"github.com/kest-labs/kest/api/internal/modules/apispec"
)

func init() {
	register("2026_04_08_000017_create_api_spec_ai_drafts_table", &createAPISpecAIDraftsTable{})
}

type createAPISpecAIDraftsTable struct {
	migration.BaseMigration
}

func (m *createAPISpecAIDraftsTable) Up(db *gorm.DB) error {
	return db.AutoMigrate(&apispec.APISpecAIDraftPO{})
}

func (m *createAPISpecAIDraftsTable) Down(db *gorm.DB) error {
	return db.Migrator().DropTable("api_spec_ai_drafts")
}
