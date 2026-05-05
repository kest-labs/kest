package migrations

import (
	"fmt"
	"strings"

	"gorm.io/gorm"

	"github.com/kest-labs/kest/api/internal/infra/migration"
)

func init() {
	register("2026_04_27_000021_migrate_legacy_uuid_columns_to_text", &migrateLegacyUUIDColumnsToText{
		BaseMigration: migration.BaseMigration{
			UseTransaction: true,
		},
	})
}

type migrateLegacyUUIDColumnsToText struct {
	migration.BaseMigration
}

type tableColumn struct {
	table  string
	column string
}

func (m *migrateLegacyUUIDColumnsToText) Up(db *gorm.DB) error {
	// This migration targets legacy PostgreSQL deployments where ID columns were
	// created as bigint before UUID/string IDs were introduced.
	if db.Dialector.Name() != "postgres" {
		return nil
	}

	columns := []tableColumn{
		{table: "projects", column: "id"},
		{table: "project_members", column: "id"},
		{table: "project_members", column: "project_id"},
		{table: "collections", column: "id"},
		{table: "collections", column: "project_id"},
		{table: "collections", column: "parent_id"},
		{table: "requests", column: "id"},
		{table: "requests", column: "collection_id"},
		{table: "examples", column: "id"},
		{table: "examples", column: "request_id"},
		{table: "api_categories", column: "id"},
		{table: "api_categories", column: "project_id"},
		{table: "api_categories", column: "parent_id"},
		{table: "api_specs", column: "id"},
		{table: "api_specs", column: "project_id"},
		{table: "api_specs", column: "category_id"},
		{table: "api_examples", column: "id"},
		{table: "api_examples", column: "api_spec_id"},
		{table: "environments", column: "id"},
		{table: "environments", column: "project_id"},
		{table: "api_flows", column: "id"},
		{table: "api_flows", column: "project_id"},
		{table: "api_flow_steps", column: "id"},
		{table: "api_flow_steps", column: "flow_id"},
		{table: "api_flow_edges", column: "id"},
		{table: "api_flow_edges", column: "flow_id"},
		{table: "api_flow_edges", column: "source_step_id"},
		{table: "api_flow_edges", column: "target_step_id"},
		{table: "api_flow_runs", column: "id"},
		{table: "api_flow_runs", column: "flow_id"},
		{table: "api_flow_step_results", column: "id"},
		{table: "api_flow_step_results", column: "run_id"},
		{table: "api_flow_step_results", column: "step_id"},
		{table: "history", column: "id"},
		{table: "history", column: "entity_id"},
		{table: "history", column: "project_id"},
		{table: "test_cases", column: "id"},
		{table: "test_cases", column: "api_spec_id"},
		{table: "test_runs", column: "id"},
		{table: "test_runs", column: "test_case_id"},
		{table: "project_cli_tokens", column: "id"},
		{table: "project_cli_tokens", column: "project_id"},
		{table: "api_spec_shares", column: "id"},
		{table: "api_spec_shares", column: "project_id"},
		{table: "api_spec_shares", column: "api_spec_id"},
		{table: "api_spec_ai_drafts", column: "id"},
		{table: "api_spec_ai_drafts", column: "project_id"},
		{table: "api_spec_ai_drafts", column: "accepted_spec_id"},
		{table: "project_invitations", column: "id"},
		{table: "project_invitations", column: "project_id"},
		{table: "audit_logs", column: "id"},
		{table: "audit_logs", column: "project_id"},
	}

	targetColumns := make(map[string]struct{}, len(columns))
	for _, tc := range columns {
		targetColumns[targetColumnKey(tc.table, tc.column)] = struct{}{}
	}

	constraints, err := dropForeignKeysForTargetColumns(db, targetColumns)
	if err != nil {
		return err
	}

	for _, tc := range columns {
		if err := alterColumnToTextIfNumeric(db, tc.table, tc.column); err != nil {
			return err
		}
	}

	return restoreForeignKeys(db, constraints)
}

func (m *migrateLegacyUUIDColumnsToText) Down(db *gorm.DB) error {
	// Intentionally irreversible: converting legacy bigint IDs to text/UUID-compatible
	// columns loses the ability to safely infer original numeric typing.
	return nil
}

func alterColumnToTextIfNumeric(db *gorm.DB, tableName, columnName string) error {
	info, exists, err := getColumnInfo(db, tableName, columnName)
	if err != nil {
		return err
	}
	if !exists || !isNumericDataType(info.dataType, info.udtName) {
		return nil
	}

	tableIdent := quoteIdent(tableName)
	columnIdent := quoteIdent(columnName)

	if err := db.Exec(
		fmt.Sprintf("ALTER TABLE %s ALTER COLUMN %s DROP DEFAULT", tableIdent, columnIdent),
	).Error; err != nil {
		return err
	}

	return db.Exec(
		fmt.Sprintf(
			"ALTER TABLE %s ALTER COLUMN %s TYPE TEXT USING %s::text",
			tableIdent,
			columnIdent,
			columnIdent,
		),
	).Error
}

type columnInfo struct {
	dataType string
	udtName  string
}

func getColumnInfo(db *gorm.DB, tableName, columnName string) (columnInfo, bool, error) {
	var info columnInfo

	query := `
SELECT data_type, udt_name
FROM information_schema.columns
WHERE table_schema = current_schema()
  AND table_name = ?
  AND column_name = ?
LIMIT 1
`
	if err := db.Raw(query, tableName, columnName).Scan(&info).Error; err != nil {
		return columnInfo{}, false, err
	}

	if strings.TrimSpace(info.dataType) == "" {
		return columnInfo{}, false, nil
	}

	return info, true, nil
}

func isNumericDataType(dataType, udtName string) bool {
	switch strings.ToLower(strings.TrimSpace(dataType)) {
	case "smallint", "integer", "bigint", "numeric", "decimal", "real", "double precision":
		return true
	}

	switch strings.ToLower(strings.TrimSpace(udtName)) {
	case "int2", "int4", "int8", "numeric", "float4", "float8":
		return true
	}

	return false
}

func quoteIdent(name string) string {
	return `"` + strings.ReplaceAll(name, `"`, `""`) + `"`
}
