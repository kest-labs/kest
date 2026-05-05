package migrations

import (
	"gorm.io/gorm"

	"github.com/kest-labs/kest/api/internal/infra/migration"
	"github.com/kest-labs/kest/api/internal/modules/flow"
)

func init() {
	register("2026_04_24_000020_add_client_key_to_flow_steps_table", &addClientKeyToFlowStepsTable{})
}

type addClientKeyToFlowStepsTable struct {
	migration.BaseMigration
}

func (m *addClientKeyToFlowStepsTable) Up(db *gorm.DB) error {
	return db.AutoMigrate(&flow.FlowStepPO{})
}

func (m *addClientKeyToFlowStepsTable) Down(db *gorm.DB) error {
	if !db.Migrator().HasColumn(&flow.FlowStepPO{}, "client_key") {
		return nil
	}

	return db.Migrator().DropColumn(&flow.FlowStepPO{}, "client_key")
}
