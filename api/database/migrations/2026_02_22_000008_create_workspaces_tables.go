package migrations

import (
	"github.com/kest-labs/kest/api/internal/infra/migration"
	"github.com/kest-labs/kest/api/internal/modules/workspace"
	"gorm.io/gorm"
)

func init() {
	register("2026_02_22_000008_create_workspaces_tables", &createWorkspacesTables{})
}

type createWorkspacesTables struct {
	migration.BaseMigration
}

func (m *createWorkspacesTables) Up(db *gorm.DB) error {
	if err := db.AutoMigrate(&workspace.WorkspacePO{}); err != nil {
		return err
	}
	return db.AutoMigrate(&workspace.WorkspaceMemberPO{})
}

func (m *createWorkspacesTables) Down(db *gorm.DB) error {
	if err := db.Migrator().DropTable("workspace_members"); err != nil {
		return err
	}
	return db.Migrator().DropTable("workspaces")
}
