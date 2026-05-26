package migrations

import (
	"gorm.io/gorm"

	"github.com/kest-labs/kest/api/internal/infra/migration"
	"github.com/kest-labs/kest/api/internal/modules/flow"
)

func init() {
	register("2026_05_26_000038_add_flow_definition_fields", &addFlowDefinitionFields{})
}

type addFlowDefinitionFields struct {
	migration.BaseMigration
}

func (m *addFlowDefinitionFields) Up(db *gorm.DB) error {
	if err := db.AutoMigrate(&flow.FlowPO{}); err != nil {
		return err
	}

	updates := map[string]interface{}{
		"revision":     1,
		"enabled":      true,
		"parse_status": flow.FlowParseStatusUnparsed,
	}
	return db.Table("api_flows").
		Where("revision = 0 OR parse_status = ''").
		Updates(updates).Error
}

func (m *addFlowDefinitionFields) Down(db *gorm.DB) error {
	for _, column := range []string{"parsed_at", "parse_error", "parse_status", "metadata", "enabled", "revision", "definition"} {
		if err := dropColumnIfExists(db, "api_flows", column); err != nil {
			return err
		}
	}
	return nil
}
