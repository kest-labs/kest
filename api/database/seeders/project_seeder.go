package seeders

import (
	"context"
	"log"

	"github.com/kest-labs/kest/api/internal/modules/project"
	"gorm.io/gorm"
)

type projectSeeder struct{}

func (s *projectSeeder) Name() string {
	return "project_seeder"
}

func (s *projectSeeder) Run(db *gorm.DB) error {
	repo := project.NewRepository(db)

	// Create a test project
	p := &project.Project{
		Name:      "Test Project",
		Slug:      "test-project",
		PublicKey: "test_public_key",
		SecretKey: "test_secret_key",
		Platform:  "go",
		Status:    1,
	}

	existing, err := repo.GetBySlug(context.Background(), p.Slug)
	if err == nil && existing != nil {
		log.Println("Test project already exists, skipping...")
		return nil
	}

	if err := repo.Create(context.Background(), p); err != nil {
		return err
	}

	log.Printf("Created test project: %s (DSN: http://%s@localhost:8025/%d)\n", p.Name, p.PublicKey, p.ID)
	return nil
}

func init() {
	register(&projectSeeder{})
}
