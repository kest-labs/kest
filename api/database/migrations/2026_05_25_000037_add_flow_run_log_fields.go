package migrations

import (
	"gorm.io/gorm"

	"github.com/kest-labs/kest/api/internal/infra/migration"
)

func init() {
	register("2026_05_25_000037_add_flow_run_log_fields", &addFlowRunLogFields{})
}

type addFlowRunLogFields struct {
	migration.BaseMigration
}

func (m *addFlowRunLogFields) Up(db *gorm.DB) error {
	for _, column := range []struct {
		name       string
		definition string
	}{
		{name: "total_steps", definition: "INTEGER NOT NULL DEFAULT 0"},
		{name: "passed_steps", definition: "INTEGER NOT NULL DEFAULT 0"},
		{name: "failed_steps", definition: "INTEGER NOT NULL DEFAULT 0"},
		{name: "duration_ms", definition: "BIGINT NOT NULL DEFAULT 0"},
		{name: "error_message", definition: "TEXT"},
		{name: "log_content", definition: "TEXT"},
		{name: "log_path", definition: "VARCHAR(500) NOT NULL DEFAULT ''"},
		{name: "log_excerpt", definition: "TEXT"},
		{name: "log_truncated", definition: "BOOLEAN NOT NULL DEFAULT false"},
	} {
		if err := addColumnIfMissing(db, "api_flow_runs", column.name, column.definition); err != nil {
			return err
		}
	}

	return nil
}

func (m *addFlowRunLogFields) Down(db *gorm.DB) error {
	for _, column := range []string{"log_truncated", "log_excerpt", "log_path", "log_content", "error_message", "duration_ms", "failed_steps", "passed_steps", "total_steps"} {
		if err := dropColumnIfExists(db, "api_flow_runs", column); err != nil {
			return err
		}
	}
	return nil
}
