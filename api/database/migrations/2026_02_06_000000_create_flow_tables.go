package migrations

import (
	"github.com/kest-labs/kest/api/internal/infra/migration"
	"github.com/kest-labs/kest/api/internal/modules/flow"
	"gorm.io/gorm"
)

func init() {
	register("2026_02_06_000000_create_flow_tables", &createFlowTables{})
}

type createFlowTables struct {
	migration.BaseMigration
}

func (m *createFlowTables) Up(db *gorm.DB) error {
	return db.AutoMigrate(
		&flow.FlowPO{},
		&flow.FlowStepPO{},
		&flow.FlowEdgePO{},
		&flow.FlowRunPO{},
		&flow.FlowStepResultPO{},
	)
}

func (m *createFlowTables) Down(db *gorm.DB) error {
	migrator := db.Migrator()
	if err := migrator.DropTable("api_flow_step_results"); err != nil {
		return err
	}
	if err := migrator.DropTable("api_flow_runs"); err != nil {
		return err
	}
	if err := migrator.DropTable("api_flow_edges"); err != nil {
		return err
	}
	if err := migrator.DropTable("api_flow_steps"); err != nil {
		return err
	}
	return migrator.DropTable("api_flows")
}
