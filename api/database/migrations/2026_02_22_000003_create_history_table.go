package migrations

import (
	"gorm.io/gorm"

	"github.com/kest-labs/kest/api/internal/infra/migration"
	"github.com/kest-labs/kest/api/internal/modules/history"
)

func init() {
	register("2026_02_22_000003_create_history_table", &createHistoryTable{})
}

type createHistoryTable struct {
	migration.BaseMigration
}

func (m *createHistoryTable) Up(db *gorm.DB) error {
	return db.AutoMigrate(&history.HistoryPO{})
}

func (m *createHistoryTable) Down(db *gorm.DB) error {
	return db.Migrator().DropTable("history")
}
