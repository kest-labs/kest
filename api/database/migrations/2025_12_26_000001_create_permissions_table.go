package migrations

import (
	"gorm.io/gorm"

	"github.com/kest-labs/kest/api/internal/infra/migration"
	"github.com/kest-labs/kest/api/internal/modules/permission"
)

func init() {
	register("2025_12_26_000001_create_permissions_table", &createPermissionsTable{})
}

// createPermissionsTable creates the permissions table.
type createPermissionsTable struct {
	migration.BaseMigration
}

// Up applies the migration.
func (m *createPermissionsTable) Up(db *gorm.DB) error {
	return db.AutoMigrate(&permission.Permission{})
}

// Down reverts the migration.
func (m *createPermissionsTable) Down(db *gorm.DB) error {
	return db.Migrator().DropTable("permissions")
}
