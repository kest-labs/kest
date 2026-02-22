package migrations

import (
	"github.com/kest-labs/kest/api/internal/infra/migration"
	"github.com/kest-labs/kest/api/internal/modules/collection"
	"gorm.io/gorm"
)

func init() {
	register("2026_02_22_000000_create_collections_table", &createCollectionsTable{})
}

type createCollectionsTable struct {
	migration.BaseMigration
}

func (m *createCollectionsTable) Up(db *gorm.DB) error {
	return db.AutoMigrate(&collection.CollectionPO{})
}

func (m *createCollectionsTable) Down(db *gorm.DB) error {
	return db.Migrator().DropTable("collections")
}
