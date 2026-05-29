package migrations

import (
	"gorm.io/gorm"

	"github.com/kest-labs/kest/api/internal/infra/migration"
	"github.com/kest-labs/kest/api/internal/modules/projectinvite"
)

func init() {
	register("2026_05_22_000034_add_workspace_id_to_project_invitations", &addWorkspaceIDToProjectInvitations{})
}

type addWorkspaceIDToProjectInvitations struct {
	migration.BaseMigration
}

func (m *addWorkspaceIDToProjectInvitations) Up(db *gorm.DB) error {
	if err := db.AutoMigrate(&projectinvite.ProjectInvitationPO{}); err != nil {
		return err
	}
	if !db.Migrator().HasTable("project_invitations") ||
		!db.Migrator().HasTable("projects") ||
		!db.Migrator().HasColumn("project_invitations", "workspace_id") ||
		!db.Migrator().HasColumn("projects", "workspace_id") {
		return nil
	}

	return db.Exec(`
		UPDATE project_invitations
		SET workspace_id = (
			SELECT projects.workspace_id
			FROM projects
			WHERE projects.id = project_invitations.project_id
		)
		WHERE (workspace_id IS NULL OR workspace_id = '')
			AND project_id IS NOT NULL
			AND project_id <> ''
	`).Error
}

func (m *addWorkspaceIDToProjectInvitations) Down(db *gorm.DB) error {
	return dropColumnIfExists(db, "project_invitations", "workspace_id")
}
