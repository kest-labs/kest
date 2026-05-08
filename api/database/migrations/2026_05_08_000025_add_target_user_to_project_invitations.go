package migrations

import (
	"github.com/kest-labs/kest/api/internal/infra/migration"
	"github.com/kest-labs/kest/api/internal/modules/projectinvite"
	"gorm.io/gorm"
)

func init() {
	register("2026_05_08_000025_add_target_user_to_project_invitations", &addTargetUserToProjectInvitations{})
}

type addTargetUserToProjectInvitations struct {
	migration.BaseMigration
}

func (m *addTargetUserToProjectInvitations) Up(db *gorm.DB) error {
	if db.Migrator().HasColumn(&projectinvite.ProjectInvitationPO{}, "TargetUserID") {
		return nil
	}

	return db.Migrator().AddColumn(&projectinvite.ProjectInvitationPO{}, "TargetUserID")
}

func (m *addTargetUserToProjectInvitations) Down(db *gorm.DB) error {
	if !db.Migrator().HasColumn(&projectinvite.ProjectInvitationPO{}, "TargetUserID") {
		return nil
	}

	return db.Migrator().DropColumn(&projectinvite.ProjectInvitationPO{}, "TargetUserID")
}
