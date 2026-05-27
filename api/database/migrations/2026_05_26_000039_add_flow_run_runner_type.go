package migrations

import (
	"gorm.io/gorm"

	"github.com/kest-labs/kest/api/internal/infra/migration"
	"github.com/kest-labs/kest/api/internal/modules/flow"
)

func init() {
	register("2026_05_26_000039_add_flow_run_runner_type", &addFlowRunRunnerType{})
}

type addFlowRunRunnerType struct {
	migration.BaseMigration
}

func (m *addFlowRunRunnerType) Up(db *gorm.DB) error {
	return db.AutoMigrate(&flow.FlowRunPO{})
}

func (m *addFlowRunRunnerType) Down(db *gorm.DB) error {
	return dropColumnIfExists(db, "api_flow_runs", "runner_type")
}
