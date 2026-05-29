package migrations

import (
	"gorm.io/gorm"

	"github.com/kest-labs/kest/api/internal/infra/migration"
)

func init() {
	register("2026_01_05_000001_create_project_members_table", &createProjectMembersTable{})
}

type createProjectMembersTable struct {
	migration.BaseMigration
}

func (m *createProjectMembersTable) Up(db *gorm.DB) error {
	return db.AutoMigrate(&legacyProjectMemberPO{})
}

func (m *createProjectMembersTable) Down(db *gorm.DB) error {
	return db.Migrator().DropTable("project_members")
}
