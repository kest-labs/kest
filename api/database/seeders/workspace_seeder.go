package seeders

import (
	"log"
	"time"

	"gorm.io/gorm"

	"github.com/kest-labs/kest/api/internal/modules/workspace"
)

type workspaceSeeder struct{}

func (s *workspaceSeeder) Name() string {
	return "workspace_seeder"
}

func (s *workspaceSeeder) Run(db *gorm.DB) error {
	repo := workspace.NewRepository(db)
	ownerID := resolveSeederWorkspaceOwnerID(db)

	testWorkspace := &workspace.WorkspacePO{
		Name:       "Test Workspace",
		Slug:       "test-workspace",
		OwnerID:    ownerID,
		Type:       workspace.TypePersonal,
		Visibility: workspace.VisibilityPrivate,
		Platform:   "go",
		Status:     1,
	}

	existing, err := repo.FindBySlug(testWorkspace.Slug)
	if err == nil && existing != nil {
		log.Println("Test workspace already exists, skipping...")
		return nil
	}

	if err := repo.Create(testWorkspace); err != nil {
		return err
	}
	if err := repo.AddMember(&workspace.WorkspaceMemberPO{
		WorkspaceID: testWorkspace.ID,
		UserID:      ownerID,
		Role:        workspace.RoleOwner,
		JoinedAt:    time.Now().UTC(),
	}); err != nil {
		return err
	}

	log.Printf("Created test workspace: %s (ID: %s)\n", testWorkspace.Name, testWorkspace.ID)
	return nil
}

func resolveSeederWorkspaceOwnerID(db *gorm.DB) string {
	var owner struct {
		ID string
	}
	if err := db.Table("users").Select("id").Where("email = ?", "admin@example.com").First(&owner).Error; err == nil && owner.ID != "" {
		return owner.ID
	}
	return "1"
}

func init() {
	register(&workspaceSeeder{})
}
