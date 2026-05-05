package migrations

import (
	"gorm.io/gorm"

	"github.com/kest-labs/kest/api/internal/infra/migration"
	"github.com/kest-labs/kest/api/internal/modules/permission"
)

func init() {
	register("2025_12_26_000003_create_user_roles_table", &createUserRolesTable{})
}

// createUserRolesTable creates the user_roles table.
type createUserRolesTable struct {
	migration.BaseMigration
}

// Up applies the migration.
func (m *createUserRolesTable) Up(db *gorm.DB) error {
	return db.AutoMigrate(&permission.UserRole{})
}

// Down reverts the migration.
func (m *createUserRolesTable) Down(db *gorm.DB) error {
	return db.Migrator().DropTable("user_roles")
}
