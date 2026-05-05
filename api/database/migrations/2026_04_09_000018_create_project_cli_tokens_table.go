package migrations

import (
	"gorm.io/gorm"

	"github.com/kest-labs/kest/api/internal/infra/migration"
	"github.com/kest-labs/kest/api/internal/modules/project"
)

func init() {
	register("2026_04_09_000018_create_project_cli_tokens_table", &createProjectCLITokensTable{})
}

type createProjectCLITokensTable struct {
	migration.BaseMigration
}

func (m *createProjectCLITokensTable) Up(db *gorm.DB) error {
	return db.AutoMigrate(&project.ProjectCLITokenPO{})
}

func (m *createProjectCLITokensTable) Down(db *gorm.DB) error {
	return db.Migrator().DropTable("project_cli_tokens")
}
