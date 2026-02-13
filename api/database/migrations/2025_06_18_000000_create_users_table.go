package migrations

import (
	"github.com/kest-labs/kest/api/internal/infra/migration"
	"github.com/kest-labs/kest/api/internal/modules/user"
	"gorm.io/gorm"
)

func init() {
	register("2025_06_18_000000_create_users_table", &createUsersTable{})
}

// createUsersTable creates the users table.
type createUsersTable struct {
	migration.BaseMigration
}

// Up applies the migration.
func (m *createUsersTable) Up(db *gorm.DB) error {
	return db.AutoMigrate(&user.UserPO{})
}

// Down reverts the migration.
func (m *createUsersTable) Down(db *gorm.DB) error {
	return db.Migrator().DropTable("users")
}
