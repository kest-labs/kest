package seeders

import (
	"github.com/kest-labs/kest/api/internal/modules/user"
	"gorm.io/gorm"
)

type UserSeeder struct{}

func (s *UserSeeder) Run(db *gorm.DB) error {
	users := []user.UserPO{
		{
			Username: "admin",
			Email:    "admin@example.com",
			Password: "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy", // password: secret
			Nickname: "Administrator",
			Status:   1,
		},
		{
			Username: "user",
			Email:    "user@example.com",
			Password: "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy", // password: secret
			Nickname: "Regular User",
			Status:   1,
		},
	}

	for _, u := range users {
		if err := db.FirstOrCreate(&u, user.UserPO{Email: u.Email}).Error; err != nil {
			return err
		}
	}

	return nil
}

func init() {
	register(&UserSeeder{})
}
