package migrations

import (
	"gorm.io/gorm"

	"github.com/kest-labs/kest/api/internal/infra/migration"
	"github.com/kest-labs/kest/api/internal/modules/flow"
)

func init() {
	register("2026_05_25_000037_add_flow_run_log_fields", &addFlowRunLogFields{})
}

type addFlowRunLogFields struct {
	migration.BaseMigration
}

func (m *addFlowRunLogFields) Up(db *gorm.DB) error {
	return db.AutoMigrate(&flow.FlowRunPO{})
}

func (m *addFlowRunLogFields) Down(db *gorm.DB) error {
	for _, column := range []string{"log_truncated", "log_excerpt", "log_path", "log_content", "error_message", "duration_ms", "failed_steps", "passed_steps", "total_steps"} {
		if err := dropColumnIfExists(db, "api_flow_runs", column); err != nil {
			return err
		}
	}
	return nil
}
