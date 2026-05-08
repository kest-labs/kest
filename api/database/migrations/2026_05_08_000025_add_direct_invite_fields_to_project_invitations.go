package migrations

import (
	"gorm.io/gorm"

	"github.com/kest-labs/kest/api/internal/infra/migration"
	"github.com/kest-labs/kest/api/internal/modules/projectinvite"
)

func init() {
	register("2026_05_08_000025_add_direct_invite_fields_to_project_invitations", &addDirectInviteFieldsToProjectInvitations{})
}

type addDirectInviteFieldsToProjectInvitations struct {
	migration.BaseMigration
}

func (m *addDirectInviteFieldsToProjectInvitations) Up(db *gorm.DB) error {
	return db.AutoMigrate(&projectinvite.ProjectInvitationPO{})
}

func (m *addDirectInviteFieldsToProjectInvitations) Down(db *gorm.DB) error {
	return dropColumnIfExists(db, "project_invitations", "invited_user_id")
}
