package migrations

import (
	"github.com/kest-labs/kest/api/internal/infra/migration"
	"github.com/kest-labs/kest/api/internal/modules/user"
	"gorm.io/gorm"
)

func init() {
	register("2025_06_18_000001_seed_default_users", &seedDefaultUsers{})
}

// seedDefaultUsers seeds the default admin user.
type seedDefaultUsers struct {
	migration.BaseMigration
}

// Up applies the migration.
func (m *seedDefaultUsers) Up(db *gorm.DB) error {
	var count int64
	db.Model(&user.UserPO{}).Count(&count)

	if count == 0 {
		adminUser := &user.UserPO{
			Username: "admin",
			Email:    "admin@example.com",
			Password: "hashed_password_here",
			Nickname: "Admin User",
			Status:   1,
		}
		return db.Create(adminUser).Error
	}
	return nil
}

// Down reverts the migration.
func (m *seedDefaultUsers) Down(db *gorm.DB) error {
	return db.Where("username = ?", "admin").Delete(&user.UserPO{}).Error
}
