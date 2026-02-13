package bootstrap

import (
	"log"

	"github.com/kest-labs/kest/api/database/seeders"
	_ "github.com/kest-labs/kest/api/database/seeders" // Import to trigger init()
	"gorm.io/gorm"
)

// RunSeeders runs all registered database seeders with the given database connection
func RunSeeders(db *gorm.DB) error {
	log.Println("Running database seeders")

	if err := seeders.RunAll(db); err != nil {
		log.Printf("Seeder failed: %v", err)
		return err
	}

	log.Printf("Successfully ran %d seeders", len(seeders.All()))
	return nil
}
