package seeders

import (
	"github.com/kest-labs/kest/api/internal/modules/permission"
	"gorm.io/gorm"
)

type RoleSeeder struct{}

func (s *RoleSeeder) Run(db *gorm.DB) error {
	roles := []permission.Role{
		{Name: "admin", DisplayName: "Administrator", Description: "Full access to all resources", IsDefault: false},
		{Name: "user", DisplayName: "User", Description: "Standard user access", IsDefault: true},
		{Name: "guest", DisplayName: "Guest", Description: "Read-only access", IsDefault: false},
		{Name: "moderator", DisplayName: "Moderator", Description: "Can moderate content", IsDefault: false},
	}

	for _, role := range roles {
		if err := db.FirstOrCreate(&role, permission.Role{Name: role.Name}).Error; err != nil {
			return err
		}
	}

	return nil
}

func init() {
	register(&RoleSeeder{})
}
