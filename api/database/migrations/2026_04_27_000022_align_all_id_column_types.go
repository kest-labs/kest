package migrations

import (
	"database/sql"
	"fmt"
	"strings"

	"gorm.io/gorm"

	"github.com/kest-labs/kest/api/internal/infra/migration"
)

func init() {
	register("2026_04_27_000022_align_all_id_column_types", &alignAllIDColumnTypes{
		BaseMigration: migration.BaseMigration{
			UseTransaction: true,
		},
	})
}

type alignAllIDColumnTypes struct {
	migration.BaseMigration
}

type expectedIDType string

const (
	idTypeText   expectedIDType = "text"
	idTypeBigInt expectedIDType = "bigint"
)

type idColumnExpectation struct {
	table         string
	column        string
	expectedType  expectedIDType
	autoIncrement bool
}

func (m *alignAllIDColumnTypes) Up(db *gorm.DB) error {
	// This migration only targets PostgreSQL deployments.
	if db.Dialector.Name() != "postgres" {
		return nil
	}

	expectations := []idColumnExpectation{
		// UUID/string primary IDs and their foreign keys.
		{table: "projects", column: "id", expectedType: idTypeText},
		{table: "project_members", column: "id", expectedType: idTypeText},
		{table: "project_members", column: "project_id", expectedType: idTypeText},
		{table: "collections", column: "id", expectedType: idTypeText},
		{table: "collections", column: "project_id", expectedType: idTypeText},
		{table: "collections", column: "parent_id", expectedType: idTypeText},
		{table: "requests", column: "id", expectedType: idTypeText},
		{table: "requests", column: "collection_id", expectedType: idTypeText},
		{table: "examples", column: "id", expectedType: idTypeText},
		{table: "examples", column: "request_id", expectedType: idTypeText},
		{table: "api_categories", column: "id", expectedType: idTypeText},
		{table: "api_categories", column: "project_id", expectedType: idTypeText},
		{table: "api_categories", column: "parent_id", expectedType: idTypeText},
		{table: "api_specs", column: "id", expectedType: idTypeText},
		{table: "api_specs", column: "project_id", expectedType: idTypeText},
		{table: "api_specs", column: "category_id", expectedType: idTypeText},
		{table: "api_examples", column: "id", expectedType: idTypeText},
		{table: "api_examples", column: "api_spec_id", expectedType: idTypeText},
		{table: "environments", column: "id", expectedType: idTypeText},
		{table: "environments", column: "project_id", expectedType: idTypeText},
		{table: "api_flows", column: "id", expectedType: idTypeText},
		{table: "api_flows", column: "project_id", expectedType: idTypeText},
		{table: "api_flow_steps", column: "id", expectedType: idTypeText},
		{table: "api_flow_steps", column: "flow_id", expectedType: idTypeText},
		{table: "api_flow_edges", column: "id", expectedType: idTypeText},
		{table: "api_flow_edges", column: "flow_id", expectedType: idTypeText},
		{table: "api_flow_edges", column: "source_step_id", expectedType: idTypeText},
		{table: "api_flow_edges", column: "target_step_id", expectedType: idTypeText},
		{table: "api_flow_runs", column: "id", expectedType: idTypeText},
		{table: "api_flow_runs", column: "flow_id", expectedType: idTypeText},
		{table: "api_flow_step_results", column: "id", expectedType: idTypeText},
		{table: "api_flow_step_results", column: "run_id", expectedType: idTypeText},
		{table: "api_flow_step_results", column: "step_id", expectedType: idTypeText},
		{table: "history", column: "id", expectedType: idTypeText},
		{table: "history", column: "entity_id", expectedType: idTypeText},
		{table: "history", column: "project_id", expectedType: idTypeText},
		{table: "test_cases", column: "id", expectedType: idTypeText},
		{table: "test_cases", column: "api_spec_id", expectedType: idTypeText},
		{table: "test_runs", column: "id", expectedType: idTypeText},
		{table: "test_runs", column: "test_case_id", expectedType: idTypeText},
		{table: "project_cli_tokens", column: "id", expectedType: idTypeText},
		{table: "project_cli_tokens", column: "project_id", expectedType: idTypeText},
		{table: "api_spec_shares", column: "id", expectedType: idTypeText},
		{table: "api_spec_shares", column: "project_id", expectedType: idTypeText},
		{table: "api_spec_shares", column: "api_spec_id", expectedType: idTypeText},
		{table: "api_spec_ai_drafts", column: "id", expectedType: idTypeText},
		{table: "api_spec_ai_drafts", column: "project_id", expectedType: idTypeText},
		{table: "api_spec_ai_drafts", column: "accepted_spec_id", expectedType: idTypeText},
		{table: "project_invitations", column: "id", expectedType: idTypeText},
		{table: "project_invitations", column: "project_id", expectedType: idTypeText},
		{table: "audit_logs", column: "id", expectedType: idTypeText},
		{table: "audit_logs", column: "project_id", expectedType: idTypeText},

		// Numeric/auto-increment user/role/workspace IDs and user-related FKs.
		{table: "users", column: "id", expectedType: idTypeBigInt, autoIncrement: true},
		{table: "roles", column: "id", expectedType: idTypeBigInt, autoIncrement: true},
		{table: "permissions", column: "id", expectedType: idTypeBigInt, autoIncrement: true},
		{table: "role_permissions", column: "id", expectedType: idTypeBigInt, autoIncrement: true},
		{table: "role_permissions", column: "role_id", expectedType: idTypeBigInt},
		{table: "role_permissions", column: "permission_id", expectedType: idTypeBigInt},
		{table: "user_roles", column: "id", expectedType: idTypeBigInt, autoIncrement: true},
		{table: "user_roles", column: "user_id", expectedType: idTypeBigInt},
		{table: "user_roles", column: "role_id", expectedType: idTypeBigInt},
		{table: "project_members", column: "user_id", expectedType: idTypeBigInt},
		{table: "api_flows", column: "created_by", expectedType: idTypeBigInt},
		{table: "api_flow_runs", column: "triggered_by", expectedType: idTypeBigInt},
		{table: "history", column: "user_id", expectedType: idTypeBigInt},
		{table: "test_cases", column: "created_by", expectedType: idTypeBigInt},
		{table: "project_cli_tokens", column: "created_by", expectedType: idTypeBigInt},
		{table: "api_spec_shares", column: "created_by", expectedType: idTypeBigInt},
		{table: "api_spec_ai_drafts", column: "created_by", expectedType: idTypeBigInt},
		{table: "project_invitations", column: "created_by", expectedType: idTypeBigInt},
		{table: "audit_logs", column: "user_id", expectedType: idTypeBigInt},
		{table: "workspaces", column: "id", expectedType: idTypeBigInt, autoIncrement: true},
		{table: "workspaces", column: "owner_id", expectedType: idTypeBigInt},
		{table: "workspace_members", column: "id", expectedType: idTypeBigInt, autoIncrement: true},
		{table: "workspace_members", column: "workspace_id", expectedType: idTypeBigInt},
		{table: "workspace_members", column: "user_id", expectedType: idTypeBigInt},
		{table: "workspace_members", column: "invited_by", expectedType: idTypeBigInt},
	}

	targetColumns := make(map[string]struct{}, len(expectations))
	for _, expectation := range expectations {
		targetColumns[targetColumnKey(expectation.table, expectation.column)] = struct{}{}
	}

	constraints, err := dropForeignKeysForTargetColumns(db, targetColumns)
	if err != nil {
		return err
	}

	for _, expectation := range expectations {
		switch expectation.expectedType {
		case idTypeText:
			if err := ensureTextIDColumn(db, expectation.table, expectation.column); err != nil {
				return err
			}
		case idTypeBigInt:
			if err := ensureBigIntIDColumn(
				db,
				expectation.table,
				expectation.column,
				expectation.autoIncrement,
			); err != nil {
				return err
			}
		}
	}

	return restoreForeignKeys(db, constraints)
}

func (m *alignAllIDColumnTypes) Down(db *gorm.DB) error {
	// Intentionally irreversible.
	return nil
}

type idColumnMeta struct {
	DataType      string         `gorm:"column:data_type"`
	UDTName       string         `gorm:"column:udt_name"`
	IsNullable    string         `gorm:"column:is_nullable"`
	ColumnDefault sql.NullString `gorm:"column:column_default"`
}

func ensureTextIDColumn(db *gorm.DB, tableName, columnName string) error {
	meta, exists, err := getIDColumnMeta(db, tableName, columnName)
	if err != nil {
		return err
	}
	if !exists || isTextLikeIDType(meta) {
		return nil
	}

	tableIdent := quoteIdent(tableName)
	columnIdent := quoteIdent(columnName)

	if err := dropColumnDefault(db, tableIdent, columnIdent); err != nil {
		return err
	}

	if err := db.Exec(
		fmt.Sprintf(
			"ALTER TABLE %s ALTER COLUMN %s TYPE TEXT USING %s::text",
			tableIdent,
			columnIdent,
			columnIdent,
		),
	).Error; err != nil {
		return err
	}

	// Preserve the legacy semantic default for global audit logs.
	if tableName == "audit_logs" && columnName == "project_id" {
		return db.Exec(
			fmt.Sprintf(
				"ALTER TABLE %s ALTER COLUMN %s SET DEFAULT '0'",
				tableIdent,
				columnIdent,
			),
		).Error
	}

	return nil
}

func ensureBigIntIDColumn(
	db *gorm.DB,
	tableName, columnName string,
	autoIncrement bool,
) error {
	meta, exists, err := getIDColumnMeta(db, tableName, columnName)
	if err != nil {
		return err
	}
	if !exists {
		return nil
	}

	tableIdent := quoteIdent(tableName)
	columnIdent := quoteIdent(columnName)

	if !isNumericDataType(meta.DataType, meta.UDTName) {
		if isTextLikeIDType(meta) {
			isConvertible, err := columnTextValuesAreNumeric(db, tableIdent, columnIdent)
			if err != nil {
				return err
			}
			if !isConvertible {
				return fmt.Errorf(
					"cannot convert %s.%s to bigint: found non-numeric existing values",
					tableName,
					columnName,
				)
			}
		}

		if err := dropColumnDefault(db, tableIdent, columnIdent); err != nil {
			return err
		}

		castExpr := fmt.Sprintf("NULLIF(BTRIM(%s::text), '')::bigint", columnIdent)
		if strings.EqualFold(strings.TrimSpace(meta.IsNullable), "NO") {
			castExpr = fmt.Sprintf("BTRIM(%s::text)::bigint", columnIdent)
		}

		if err := db.Exec(
			fmt.Sprintf(
				"ALTER TABLE %s ALTER COLUMN %s TYPE BIGINT USING %s",
				tableIdent,
				columnIdent,
				castExpr,
			),
		).Error; err != nil {
			return err
		}
	}

	if !autoIncrement {
		return nil
	}

	return ensureBigIntAutoIncrementDefault(db, tableName, columnName)
}

func ensureBigIntAutoIncrementDefault(db *gorm.DB, tableName, columnName string) error {
	meta, exists, err := getIDColumnMeta(db, tableName, columnName)
	if err != nil {
		return err
	}
	if !exists {
		return nil
	}

	if meta.ColumnDefault.Valid && strings.Contains(strings.ToLower(meta.ColumnDefault.String), "nextval(") {
		return nil
	}

	sequenceName := fmt.Sprintf("%s_%s_seq", tableName, columnName)
	sequenceIdent := quoteIdent(sequenceName)
	tableIdent := quoteIdent(tableName)
	columnIdent := quoteIdent(columnName)

	if err := db.Exec(fmt.Sprintf("CREATE SEQUENCE IF NOT EXISTS %s", sequenceIdent)).Error; err != nil {
		return err
	}

	var maxID sql.NullInt64
	if err := db.Raw(
		fmt.Sprintf("SELECT MAX(%s) AS max_id FROM %s", columnIdent, tableIdent),
	).Scan(&maxID).Error; err != nil {
		return err
	}

	if maxID.Valid {
		if err := db.Exec("SELECT setval(?, ?, true)", sequenceName, maxID.Int64).Error; err != nil {
			return err
		}
	} else {
		if err := db.Exec("SELECT setval(?, 1, false)", sequenceName).Error; err != nil {
			return err
		}
	}

	return db.Exec(
		fmt.Sprintf(
			"ALTER TABLE %s ALTER COLUMN %s SET DEFAULT nextval(%s::regclass)",
			tableIdent,
			columnIdent,
			quoteSQLString(sequenceName),
		),
	).Error
}

func getIDColumnMeta(db *gorm.DB, tableName, columnName string) (idColumnMeta, bool, error) {
	var meta idColumnMeta

	const query = `
SELECT data_type, udt_name, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = current_schema()
  AND table_name = ?
  AND column_name = ?
LIMIT 1
`
	if err := db.Raw(query, tableName, columnName).Scan(&meta).Error; err != nil {
		return idColumnMeta{}, false, err
	}

	if strings.TrimSpace(meta.DataType) == "" {
		return idColumnMeta{}, false, nil
	}

	return meta, true, nil
}

func dropColumnDefault(db *gorm.DB, tableIdent, columnIdent string) error {
	return db.Exec(
		fmt.Sprintf("ALTER TABLE %s ALTER COLUMN %s DROP DEFAULT", tableIdent, columnIdent),
	).Error
}

func isTextLikeIDType(meta idColumnMeta) bool {
	switch strings.ToLower(strings.TrimSpace(meta.DataType)) {
	case "text", "character varying", "character", "uuid":
		return true
	}

	switch strings.ToLower(strings.TrimSpace(meta.UDTName)) {
	case "text", "varchar", "bpchar", "uuid":
		return true
	}

	return false
}

func columnTextValuesAreNumeric(db *gorm.DB, tableIdent, columnIdent string) (bool, error) {
	var nonNumericCount int64
	query := fmt.Sprintf(
		`SELECT COUNT(*) FROM %s WHERE %s IS NOT NULL AND BTRIM(%s::text) <> '' AND BTRIM(%s::text) !~ '^[0-9]+$'`,
		tableIdent,
		columnIdent,
		columnIdent,
		columnIdent,
	)
	if err := db.Raw(query).Scan(&nonNumericCount).Error; err != nil {
		return false, err
	}
	return nonNumericCount == 0, nil
}

func quoteSQLString(value string) string {
	return "'" + strings.ReplaceAll(value, "'", "''") + "'"
}
