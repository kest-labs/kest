package migrations

import (
	"github.com/kest-labs/kest/api/internal/infra/migration"
	"github.com/kest-labs/kest/api/internal/modules/member"
	"gorm.io/gorm"
)

func init() {
	register("2026_01_05_000001_create_project_members_table", &createProjectMembersTable{})
}

type createProjectMembersTable struct {
	migration.BaseMigration
}

func (m *createProjectMembersTable) Up(db *gorm.DB) error {
	return db.AutoMigrate(&member.ProjectMemberPO{})
}

func (m *createProjectMembersTable) Down(db *gorm.DB) error {
	return db.Migrator().DropTable("project_members")
}
