package migrations

import (
	"github.com/kest-labs/kest/api/internal/infra/migration"
	"github.com/kest-labs/kest/api/internal/modules/category"
	"gorm.io/gorm"
)

func init() {
	register("2026_02_22_000005_create_categories_table", &createCategoriesTable{})
}

type createCategoriesTable struct {
	migration.BaseMigration
}

func (m *createCategoriesTable) Up(db *gorm.DB) error {
	return db.AutoMigrate(&category.CategoryPO{})
}

func (m *createCategoriesTable) Down(db *gorm.DB) error {
	return db.Migrator().DropTable("categories")
}
