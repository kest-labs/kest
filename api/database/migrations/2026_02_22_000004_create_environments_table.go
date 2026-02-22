package migrations

import (
	"github.com/kest-labs/kest/api/internal/infra/migration"
	"github.com/kest-labs/kest/api/internal/modules/environment"
	"gorm.io/gorm"
)

func init() {
	register("2026_02_22_000004_create_environments_table", &createEnvironmentsTable{})
}

type createEnvironmentsTable struct {
	migration.BaseMigration
}

func (m *createEnvironmentsTable) Up(db *gorm.DB) error {
	return db.AutoMigrate(&environment.EnvironmentPO{})
}

func (m *createEnvironmentsTable) Down(db *gorm.DB) error {
	return db.Migrator().DropTable("environments")
}
