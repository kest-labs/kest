package migrations

import (
	"time"

	"gorm.io/gorm"

	"github.com/kest-labs/kest/api/internal/infra/migration"
)

func init() {
	register("2026_05_18_000031_move_cli_tokens_to_workspaces", &moveCLITokensToWorkspaces{
		BaseMigration: migration.BaseMigration{
			UseTransaction: true,
		},
	})
}

type moveCLITokensToWorkspaces struct {
	migration.BaseMigration
}

func (m *moveCLITokensToWorkspaces) Up(db *gorm.DB) error {
	if !db.Migrator().HasTable("workspace_cli_tokens") &&
		db.Migrator().HasTable("project_cli_tokens") {
		if err := db.Migrator().RenameTable("project_cli_tokens", "workspace_cli_tokens"); err != nil {
			return err
		}
	}

	if !db.Migrator().HasTable("workspace_cli_tokens") {
		if err := db.AutoMigrate(&workspaceCLITokenMigrationModel{}); err != nil {
			return err
		}
	}

	if db.Migrator().HasColumn("workspace_cli_tokens", "project_id") &&
		!db.Migrator().HasColumn("workspace_cli_tokens", "workspace_id") {
		return db.Migrator().RenameColumn("workspace_cli_tokens", "project_id", "workspace_id")
	}

	if !db.Migrator().HasColumn("workspace_cli_tokens", "workspace_id") {
		return db.Migrator().AddColumn(&workspaceCLITokenWorkspaceColumn{}, "WorkspaceID")
	}

	return nil
}

func (m *moveCLITokensToWorkspaces) Down(db *gorm.DB) error {
	if !db.Migrator().HasTable("workspace_cli_tokens") {
		return nil
	}

	if db.Migrator().HasColumn("workspace_cli_tokens", "workspace_id") &&
		!db.Migrator().HasColumn("workspace_cli_tokens", "project_id") {
		if err := db.Migrator().RenameColumn("workspace_cli_tokens", "workspace_id", "project_id"); err != nil {
			return err
		}
	}

	if !db.Migrator().HasTable("project_cli_tokens") {
		return db.Migrator().RenameTable("workspace_cli_tokens", "project_cli_tokens")
	}

	return nil
}

type workspaceCLITokenMigrationModel struct {
	ID          string `gorm:"primaryKey"`
	WorkspaceID string `gorm:"not null;index"`
	CreatedBy   string `gorm:"not null;index"`
	Name        string `gorm:"size:100;not null"`
	TokenPrefix string `gorm:"size:32;not null;index"`
	TokenHash   string `gorm:"size:64;not null;uniqueIndex"`
	Scopes      string `gorm:"type:text"`
	LastUsedAt  *time.Time
	ExpiresAt   *time.Time
	CreatedAt   time.Time
	UpdatedAt   time.Time
	DeletedAt   gorm.DeletedAt `gorm:"index"`
}

func (workspaceCLITokenMigrationModel) TableName() string {
	return "workspace_cli_tokens"
}

type workspaceCLITokenWorkspaceColumn struct {
	WorkspaceID string `gorm:"not null;index"`
}

func (workspaceCLITokenWorkspaceColumn) TableName() string {
	return "workspace_cli_tokens"
}
