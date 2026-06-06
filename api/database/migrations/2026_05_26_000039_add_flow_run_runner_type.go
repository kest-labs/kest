package migrations

import (
	"gorm.io/gorm"

	"github.com/kest-labs/kest/api/internal/infra/migration"
)

func init() {
	register("2026_05_26_000039_add_flow_run_runner_type", &addFlowRunRunnerType{})
}

type addFlowRunRunnerType struct {
	migration.BaseMigration
}

func (m *addFlowRunRunnerType) Up(db *gorm.DB) error {
	if err := addColumnIfMissing(db, "api_flow_runs", "runner_type", "VARCHAR(32) NOT NULL DEFAULT ''"); err != nil {
		return err
	}
	return createIndexIfMissing(db, "api_flow_runs", "idx_api_flow_runs_runner_type", "runner_type")
}

func (m *addFlowRunRunnerType) Down(db *gorm.DB) error {
	return dropColumnIfExists(db, "api_flow_runs", "runner_type")
}
