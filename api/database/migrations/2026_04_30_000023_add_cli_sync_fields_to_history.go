package migrations

import (
	"github.com/kest-labs/kest/api/internal/infra/migration"
	"github.com/kest-labs/kest/api/internal/modules/history"
	"gorm.io/gorm"
)

func init() {
	register("2026_04_30_000023_add_cli_sync_fields_to_history", &addCLISyncFieldsToHistory{
		BaseMigration: migration.BaseMigration{
			UseTransaction: true,
		},
	})
}

type addCLISyncFieldsToHistory struct {
	migration.BaseMigration
}

func (m *addCLISyncFieldsToHistory) Up(db *gorm.DB) error {
	if err := db.AutoMigrate(&history.HistoryPO{}); err != nil {
		return err
	}

	if err := db.Exec(`
		UPDATE history
		   SET source = COALESCE(NULLIF(source, ''), 'legacy'),
		       source_event_id = COALESCE(NULLIF(source_event_id, ''), 'legacy-' || id)
		 WHERE source IS NULL OR source = '' OR source_event_id IS NULL OR source_event_id = ''
	`).Error; err != nil {
		return err
	}

	return db.Exec(`
		CREATE UNIQUE INDEX IF NOT EXISTS idx_history_project_source_event
		    ON history(project_id, source, source_event_id)
	`).Error
}

func (m *addCLISyncFieldsToHistory) Down(db *gorm.DB) error {
	return db.Exec(`DROP INDEX IF EXISTS idx_history_project_source_event`).Error
}
