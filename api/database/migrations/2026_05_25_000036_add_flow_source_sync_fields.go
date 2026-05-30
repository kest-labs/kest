package migrations

import (
	"gorm.io/gorm"

	"github.com/kest-labs/kest/api/internal/infra/migration"
)

func init() {
	register("2026_05_25_000036_add_flow_source_sync_fields", &addFlowSourceSyncFields{})
}

type addFlowSourceSyncFields struct {
	migration.BaseMigration
}

func (m *addFlowSourceSyncFields) Up(db *gorm.DB) error {
	for _, column := range []struct {
		table      string
		name       string
		definition string
	}{
		{table: "api_flows", name: "source", definition: "VARCHAR(32) NOT NULL DEFAULT 'web'"},
		{table: "api_flows", name: "source_id", definition: "VARCHAR(255) NOT NULL DEFAULT ''"},
		{table: "api_flows", name: "source_path", definition: "VARCHAR(500) NOT NULL DEFAULT ''"},
		{table: "api_flows", name: "source_hash", definition: "VARCHAR(64) NOT NULL DEFAULT ''"},
		{table: "api_flows", name: "source_read_only", definition: "BOOLEAN NOT NULL DEFAULT false"},
		{table: "api_flow_steps", name: "source_id", definition: "VARCHAR(255) NOT NULL DEFAULT ''"},
		{table: "api_flow_steps", name: "step_type", definition: "VARCHAR(20) NOT NULL DEFAULT 'http'"},
		{table: "api_flow_runs", name: "execution_mode", definition: "VARCHAR(20) NOT NULL DEFAULT 'server'"},
		{table: "api_flow_runs", name: "source", definition: "VARCHAR(32) NOT NULL DEFAULT 'web'"},
		{table: "api_flow_runs", name: "source_event_id", definition: "VARCHAR(191) NOT NULL DEFAULT ''"},
		{table: "api_flow_runs", name: "profile", definition: "VARCHAR(50) NOT NULL DEFAULT ''"},
		{table: "api_flow_runs", name: "environment", definition: "VARCHAR(100) NOT NULL DEFAULT ''"},
		{table: "api_flow_runs", name: "base_url", definition: "VARCHAR(500) NOT NULL DEFAULT ''"},
	} {
		if err := addColumnIfMissing(db, column.table, column.name, column.definition); err != nil {
			return err
		}
	}

	for _, index := range []struct {
		table      string
		name       string
		definition string
	}{
		{table: "api_flows", name: "idx_flows_source", definition: "source, source_id"},
		{table: "api_flows", name: "idx_api_flows_source_path", definition: "source_path"},
		{table: "api_flow_steps", name: "idx_api_flow_steps_source_id", definition: "source_id"},
		{table: "api_flow_runs", name: "idx_api_flow_runs_source", definition: "source"},
		{table: "api_flow_runs", name: "idx_api_flow_runs_source_event_id", definition: "source_event_id"},
	} {
		if err := createIndexIfMissing(db, index.table, index.name, index.definition); err != nil {
			return err
		}
	}

	return nil
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
