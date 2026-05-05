package migrations

import (
	"gorm.io/gorm"

	"github.com/kest-labs/kest/api/internal/infra/migration"
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
	if !db.Migrator().HasTable("history") {
		return nil
	}

	if err := addColumnIfMissing(db, "history", "source", "VARCHAR(32)"); err != nil {
		return err
	}

	if err := addColumnIfMissing(db, "history", "source_event_id", "VARCHAR(191)"); err != nil {
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

	if db.Dialector.Name() != "sqlite" {
		if err := db.Exec(`
			ALTER TABLE history
			ALTER COLUMN source SET DEFAULT 'web',
			ALTER COLUMN source SET NOT NULL,
			ALTER COLUMN source_event_id SET NOT NULL
		`).Error; err != nil {
			return err
		}
	}

	return db.Exec(`
		CREATE UNIQUE INDEX IF NOT EXISTS idx_history_project_source_event
		    ON history(project_id, source, source_event_id)
	`).Error
}

func (m *addCLISyncFieldsToHistory) Down(db *gorm.DB) error {
	if err := db.Exec(`DROP INDEX IF EXISTS idx_history_project_source_event`).Error; err != nil {
		return err
	}
	if err := dropColumnIfExists(db, "history", "source_event_id"); err != nil {
		return err
	}
	return dropColumnIfExists(db, "history", "source")
}
