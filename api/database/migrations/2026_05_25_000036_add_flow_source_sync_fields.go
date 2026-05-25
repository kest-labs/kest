package migrations

import (
	"gorm.io/gorm"

	"github.com/kest-labs/kest/api/internal/infra/migration"
	"github.com/kest-labs/kest/api/internal/modules/flow"
)

func init() {
	register("2026_05_25_000036_add_flow_source_sync_fields", &addFlowSourceSyncFields{})
}

type addFlowSourceSyncFields struct {
	migration.BaseMigration
}

func (m *addFlowSourceSyncFields) Up(db *gorm.DB) error {
	return db.AutoMigrate(
		&flow.FlowPO{},
		&flow.FlowStepPO{},
		&flow.FlowRunPO{},
	)
}

func (m *addFlowSourceSyncFields) Down(db *gorm.DB) error {
	for _, column := range []string{"base_url", "environment", "profile", "source_event_id", "source", "execution_mode"} {
		if err := dropColumnIfExists(db, "api_flow_runs", column); err != nil {
			return err
		}
	}
	for _, column := range []string{"source_id", "step_type"} {
		if err := dropColumnIfExists(db, "api_flow_steps", column); err != nil {
			return err
		}
	}
	for _, column := range []string{"source_read_only", "source_hash", "source_path", "source_id", "source"} {
		if err := dropColumnIfExists(db, "api_flows", column); err != nil {
			return err
		}
	}
	return nil
}
