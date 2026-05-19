package migrations

import (
	"time"

	"gorm.io/gorm"

	"github.com/kest-labs/kest/api/internal/infra/migration"
)

func init() {
	register("2026_04_09_000018_create_project_cli_tokens_table", &createProjectCLITokensTable{})
}

type createProjectCLITokensTable struct {
	migration.BaseMigration
}

func (m *createProjectCLITokensTable) Up(db *gorm.DB) error {
	return db.AutoMigrate(&projectCLITokenMigrationModel{})
}

func (m *createProjectCLITokensTable) Down(db *gorm.DB) error {
	return db.Migrator().DropTable("project_cli_tokens")
}

type projectCLITokenMigrationModel struct {
	ID          string `gorm:"primaryKey"`
	ProjectID   string `gorm:"not null;index"`
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

func (projectCLITokenMigrationModel) TableName() string {
	return "project_cli_tokens"
}
