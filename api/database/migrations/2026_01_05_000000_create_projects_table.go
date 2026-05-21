package migrations

import (
	"gorm.io/gorm"

	"github.com/kest-labs/kest/api/internal/infra/migration"
)

func init() {
	register("2026_01_05_000000_create_projects_table", &createProjectsTable{})
}

type createProjectsTable struct {
	migration.BaseMigration
}

func (m *createProjectsTable) Up(db *gorm.DB) error {
	return db.AutoMigrate(&legacyProjectPO{})
}

func (m *createProjectsTable) Down(db *gorm.DB) error {
	return db.Migrator().DropTable("projects")
}
