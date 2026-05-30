package migrations

import (
	"testing"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func TestFlowSourceSyncMigrationDoesNotAddDefinitionFieldsEarly(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	require.NoError(t, err)

	require.NoError(t, db.Exec(`
		CREATE TABLE api_flows (
			id TEXT PRIMARY KEY,
			workspace_id TEXT NOT NULL,
			name TEXT NOT NULL,
			description TEXT,
			created_by TEXT NOT NULL,
			created_at DATETIME,
			updated_at DATETIME,
			deleted_at DATETIME
		)`).Error)
	require.NoError(t, db.Exec(`
		CREATE TABLE api_flow_steps (
			id TEXT PRIMARY KEY,
			flow_id TEXT NOT NULL,
			name TEXT NOT NULL,
			sort_order INTEGER,
			method TEXT NOT NULL,
			url TEXT NOT NULL,
			headers TEXT,
			body TEXT,
			captures TEXT,
			asserts TEXT,
			position_x REAL,
			position_y REAL,
			created_at DATETIME,
			updated_at DATETIME,
			deleted_at DATETIME
		)`).Error)
	require.NoError(t, db.Exec(`
		CREATE TABLE api_flow_runs (
			id TEXT PRIMARY KEY,
			flow_id TEXT NOT NULL,
			status TEXT NOT NULL,
			triggered_by TEXT NOT NULL,
			started_at DATETIME,
			finished_at DATETIME,
			created_at DATETIME,
			updated_at DATETIME,
			deleted_at DATETIME
		)`).Error)
	require.NoError(t, db.Exec(`
		INSERT INTO api_flows (id, workspace_id, name, created_by)
		VALUES ('flow-1', 'workspace-1', 'Smoke', 'user-1')
	`).Error)

	require.NoError(t, (&addFlowSourceSyncFields{}).Up(db))
	require.False(t, db.Migrator().HasColumn("api_flows", "enabled"))
	require.True(t, db.Migrator().HasColumn("api_flows", "source"))
	require.True(t, db.Migrator().HasColumn("api_flow_steps", "step_type"))
	require.True(t, db.Migrator().HasColumn("api_flow_runs", "source_event_id"))

	require.NoError(t, (&addFlowDefinitionFields{}).Up(db))

	var enabled bool
	require.NoError(t, db.Raw("SELECT enabled FROM api_flows WHERE id = ?", "flow-1").Scan(&enabled).Error)
	require.True(t, enabled)
}
