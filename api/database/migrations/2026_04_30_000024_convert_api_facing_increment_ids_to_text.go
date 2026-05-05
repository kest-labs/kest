package migrations

import (
	"gorm.io/gorm"

	"github.com/kest-labs/kest/api/internal/infra/migration"
)

func init() {
	register("2026_04_30_000024_convert_api_facing_increment_ids_to_text", &convertAPIFacingIncrementIDsToText{
		BaseMigration: migration.BaseMigration{
			UseTransaction: true,
		},
	})
}

type convertAPIFacingIncrementIDsToText struct {
	migration.BaseMigration
}

func (m *convertAPIFacingIncrementIDsToText) Up(db *gorm.DB) error {
	if db.Dialector.Name() != "postgres" {
		return nil
	}

	columns := []tableColumn{
		{table: "users", column: "id"},
		{table: "roles", column: "id"},
		{table: "permissions", column: "id"},
		{table: "role_permissions", column: "id"},
		{table: "role_permissions", column: "role_id"},
		{table: "role_permissions", column: "permission_id"},
		{table: "user_roles", column: "id"},
		{table: "user_roles", column: "user_id"},
		{table: "user_roles", column: "role_id"},
		{table: "project_members", column: "user_id"},
		{table: "api_flows", column: "created_by"},
		{table: "api_flow_runs", column: "triggered_by"},
		{table: "history", column: "user_id"},
		{table: "test_cases", column: "created_by"},
		{table: "project_cli_tokens", column: "created_by"},
		{table: "api_spec_shares", column: "created_by"},
		{table: "api_spec_ai_drafts", column: "created_by"},
		{table: "project_invitations", column: "created_by"},
		{table: "audit_logs", column: "user_id"},
		{table: "workspaces", column: "id"},
		{table: "workspaces", column: "owner_id"},
		{table: "workspace_members", column: "id"},
		{table: "workspace_members", column: "workspace_id"},
		{table: "workspace_members", column: "user_id"},
		{table: "workspace_members", column: "invited_by"},
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
		if err := ensureTextIDColumn(db, tc.table, tc.column); err != nil {
			return err
		}
	}

	return restoreForeignKeys(db, constraints)
}

func (m *convertAPIFacingIncrementIDsToText) Down(db *gorm.DB) error {
	return nil
}
