package migrations

import (
	"github.com/kest-labs/kest/api/internal/infra/migration"
	"github.com/kest-labs/kest/api/internal/modules/permission"
	"gorm.io/gorm"
)

func init() {
	register("2025_12_26_000002_create_role_permissions_table", &createRolePermissionsTable{})
}

// createRolePermissionsTable creates the role_permissions table.
type createRolePermissionsTable struct {
	migration.BaseMigration
}

// Up applies the migration.
func (m *createRolePermissionsTable) Up(db *gorm.DB) error {
	return db.AutoMigrate(&permission.RolePermission{})
}

// Down reverts the migration.
func (m *createRolePermissionsTable) Down(db *gorm.DB) error {
	return db.Migrator().DropTable("role_permissions")
}
