package migrations

import (
	"github.com/kest-labs/kest/api/internal/infra/migration"
	"github.com/kest-labs/kest/api/internal/modules/permission"
	"gorm.io/gorm"
)

func init() {
	register("2025_12_26_000000_create_roles_table", &createRolesTable{})
}

// createRolesTable creates the roles table.
type createRolesTable struct {
	migration.BaseMigration
}

// Up applies the migration.
func (m *createRolesTable) Up(db *gorm.DB) error {
	return db.AutoMigrate(&permission.Role{})
}

// Down reverts the migration.
func (m *createRolesTable) Down(db *gorm.DB) error {
	return db.Migrator().DropTable("roles")
}
