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
	if !db.Migrator().HasTable("api_flows") {
		return db.AutoMigrate(&flow.FlowPO{})
	}

	columns := []struct {
		name       string
		definition string
	}{
		{name: "definition", definition: "TEXT"},
		{name: "revision", definition: "INTEGER NOT NULL DEFAULT 1"},
		{name: "enabled", definition: "BOOLEAN NOT NULL DEFAULT true"},
		{name: "metadata", definition: "TEXT"},
		{name: "parse_status", definition: "VARCHAR(20) NOT NULL DEFAULT 'unparsed'"},
		{name: "parse_error", definition: "TEXT"},
		{name: "parsed_at", definition: "TIMESTAMP NULL"},
	}
	for _, column := range columns {
		if err := addColumnIfMissing(db, "api_flows", column.name, column.definition); err != nil {
			return err
		}
	}

	if err := db.Exec("UPDATE api_flows SET revision = 1 WHERE revision IS NULL OR revision = 0").Error; err != nil {
		return err
	}
	if err := db.Exec("UPDATE api_flows SET enabled = true WHERE enabled IS NULL").Error; err != nil {
		return err
	}
	return db.Exec("UPDATE api_flows SET parse_status = ? WHERE parse_status IS NULL OR parse_status = ''", flow.FlowParseStatusUnparsed).Error
}

func (m *addFlowDefinitionFields) Down(db *gorm.DB) error {
	for _, column := range []string{"parsed_at", "parse_error", "parse_status", "metadata", "enabled", "revision", "definition"} {
		if err := dropColumnIfExists(db, "api_flows", column); err != nil {
			return err
		}
	}
	return nil
}
