package migrations

import (
	"github.com/kest-labs/kest/api/internal/infra/migration"
	"github.com/kest-labs/kest/api/internal/modules/history"
	"gorm.io/gorm"
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
