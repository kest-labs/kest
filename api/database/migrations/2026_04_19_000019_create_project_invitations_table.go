package migrations

import (
	"gorm.io/gorm"

	"github.com/kest-labs/kest/api/internal/infra/migration"
)

func init() {
	register("2026_04_19_000019_create_project_invitations_table", &createProjectInvitationsTable{})
}

type createProjectInvitationsTable struct {
	migration.BaseMigration
}

func (m *createProjectInvitationsTable) Up(db *gorm.DB) error {
	return db.AutoMigrate(&legacyProjectInvitationPO{})
}

func (m *createProjectInvitationsTable) Down(db *gorm.DB) error {
	return db.Migrator().DropTable("project_invitations")
}
