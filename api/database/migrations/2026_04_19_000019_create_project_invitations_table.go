package migrations

import (
	"github.com/kest-labs/kest/api/internal/infra/migration"
	"github.com/kest-labs/kest/api/internal/modules/projectinvite"
	"gorm.io/gorm"
)

func init() {
	register("2026_04_19_000019_create_project_invitations_table", &createProjectInvitationsTable{})
}

type createProjectInvitationsTable struct {
	migration.BaseMigration
}

func (m *createProjectInvitationsTable) Up(db *gorm.DB) error {
	return db.AutoMigrate(&projectinvite.ProjectInvitationPO{})
}

func (m *createProjectInvitationsTable) Down(db *gorm.DB) error {
	return db.Migrator().DropTable("project_invitations")
}
