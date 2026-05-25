package flow

import (
	"context"
	"path/filepath"
	"reflect"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func TestSyncFlowsFromCLICreatesReadOnlyFlow(t *testing.T) {
	db := newFlowSyncTestDB(t)
	createFlowSyncTestTables(t, db)

	svc := NewService(NewRepository(db))
	result, err := svc.SyncFlowsFromCLI(context.Background(), "workspace-1", "user-1", &CLIFlowSyncRequest{
		Source: "cli",
		Flows: []CLIFlowSyncItem{
			{
				SourceID:   "auth-flow",
				SourcePath: ".kest/flow/auth.flow.md",
				SourceHash: "hash-1",
				Name:       "Auth flow",
				ReadOnly:   true,
				Steps: []CLIFlowStepSyncItem{
					{SourceID: "login", Name: "Login", SortOrder: 0, Type: "http", Method: "POST", URL: "/login"},
					{SourceID: "profile", Name: "Profile", SortOrder: 1, Type: "http", Method: "GET", URL: "/profile"},
				},
				Edges: []CLIFlowEdgeSyncItem{{SourceStepID: "login", TargetStepID: "profile"}},
			},
		},
	})
	require.NoError(t, err)
	require.Equal(t, 1, result.Created)

	flows, err := svc.ListFlows(context.Background(), "workspace-1")
	require.NoError(t, err)
	require.Len(t, flows, 1)
	require.Equal(t, "cli", flows[0].Source)
	require.True(t, flows[0].SourceReadOnly)
	require.Equal(t, 2, flows[0].StepCount)

	detail, err := svc.GetFlow(context.Background(), flows[0].ID)
	require.NoError(t, err)
	require.True(t, detail.SourceReadOnly)
	require.Len(t, detail.Steps, 2)

	_, err = svc.UpdateFlow(context.Background(), flows[0].ID, &UpdateFlowRequest{Name: ptrString("Changed")})
	require.Error(t, err)

	_, err = svc.SaveFlow(context.Background(), flows[0].ID, &SaveFlowRequest{Name: ptrString("Changed")})
	require.Error(t, err)
}

func TestSyncFlowRunFromCLICreatesRunAndResults(t *testing.T) {
	db := newFlowSyncTestDB(t)
	createFlowSyncTestTables(t, db)

	svc := NewService(NewRepository(db))
	_, err := svc.SyncFlowsFromCLI(context.Background(), "workspace-1", "user-1", &CLIFlowSyncRequest{
		Source: "cli",
		Flows: []CLIFlowSyncItem{
			{
				SourceID:   "auth-flow",
				SourcePath: ".kest/flow/auth.flow.md",
				Name:       "Auth flow",
				ReadOnly:   true,
				Steps:      []CLIFlowStepSyncItem{{SourceID: "login", Name: "Login", Method: "POST", URL: "/login"}},
			},
		},
	})
	require.NoError(t, err)

	now := time.Now().UTC()
	result, err := svc.SyncFlowRunFromCLI(context.Background(), "workspace-1", "user-1", &CLIFlowRunSyncRequest{
		Source:        "cli",
		SourceEventID: "client-1:flow-run:1",
		Run: CLIFlowRunSyncItem{
			SourceFlowID: "auth-flow",
			SourcePath:   ".kest/flow/auth.flow.md",
			Profile:      "ci",
			Status:       "passed",
			StartedAt:    now,
			FinishedAt:   now.Add(50 * time.Millisecond),
		},
		Results: []CLIFlowRunResultSyncItem{
			{SourceStepID: "login", Name: "Login", Method: "POST", Status: "passed", HTTPStatus: 200, DurationMs: 50, StartedAt: now},
		},
	})
	require.NoError(t, err)
	require.Equal(t, 1, result.Created)

	flows, err := svc.ListFlows(context.Background(), "workspace-1")
	require.NoError(t, err)
	require.Len(t, flows, 1)
	runs, err := svc.ListRuns(context.Background(), flows[0].ID)
	require.NoError(t, err)
	require.Len(t, runs, 1)
	require.Equal(t, "cli", runs[0].ExecutionMode)
	require.Equal(t, "ci", runs[0].Profile)

	detail, err := svc.GetRun(context.Background(), runs[0].ID)
	require.NoError(t, err)
	require.Len(t, detail.StepResults, 1)
	require.Equal(t, "passed", detail.StepResults[0].Status)
}

func ptrString(value string) *string {
	return &value
}

func newFlowSyncTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	db, err := gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "flow-sync.db")), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.Callback().Create().Before("gorm:before_create").Register("test:assign_uuid_primary_key", func(tx *gorm.DB) {
		if tx == nil || tx.Statement == nil || tx.Statement.Schema == nil {
			return
		}

		idField := tx.Statement.Schema.LookUpField("ID")
		if idField == nil || idField.FieldType.Kind() != reflect.String {
			return
		}

		assignID := func(value reflect.Value) {
			if !value.IsValid() {
				return
			}
			for value.Kind() == reflect.Ptr {
				if value.IsNil() {
					return
				}
				value = value.Elem()
			}
			if value.Kind() != reflect.Struct {
				return
			}
			_, isZero := idField.ValueOf(tx.Statement.Context, value)
			if !isZero {
				return
			}
			_ = idField.Set(tx.Statement.Context, value, uuid.NewString())
		}

		value := tx.Statement.ReflectValue
		switch value.Kind() {
		case reflect.Slice, reflect.Array:
			for i := 0; i < value.Len(); i++ {
				assignID(value.Index(i))
			}
		default:
			assignID(value)
		}
	}))
	return db
}

func createFlowSyncTestTables(t *testing.T, db interface {
	Exec(sql string, values ...interface{}) *gorm.DB
}) {
	t.Helper()
	statements := []string{
		`CREATE TABLE api_flows (
			id TEXT PRIMARY KEY,
			workspace_id TEXT NOT NULL,
			name TEXT NOT NULL,
			description TEXT,
			created_by TEXT NOT NULL,
			source TEXT NOT NULL DEFAULT 'web',
			source_id TEXT NOT NULL DEFAULT '',
			source_path TEXT NOT NULL DEFAULT '',
			source_hash TEXT NOT NULL DEFAULT '',
			source_read_only NUMERIC NOT NULL DEFAULT false,
			created_at DATETIME,
			updated_at DATETIME,
			deleted_at DATETIME
		)`,
		`CREATE TABLE api_flow_steps (
			id TEXT PRIMARY KEY,
			flow_id TEXT NOT NULL,
			client_key TEXT NOT NULL DEFAULT '',
			name TEXT NOT NULL,
			sort_order INTEGER DEFAULT 0,
			method TEXT NOT NULL,
			url TEXT NOT NULL,
			headers TEXT,
			body TEXT,
			captures TEXT,
			asserts TEXT,
			step_type TEXT NOT NULL DEFAULT 'http',
			source_id TEXT NOT NULL DEFAULT '',
			position_x REAL DEFAULT 0,
			position_y REAL DEFAULT 0,
			created_at DATETIME,
			updated_at DATETIME,
			deleted_at DATETIME
		)`,
		`CREATE TABLE api_flow_edges (
			id TEXT PRIMARY KEY,
			flow_id TEXT NOT NULL,
			source_step_id TEXT NOT NULL,
			target_step_id TEXT NOT NULL,
			variable_mapping TEXT,
			created_at DATETIME,
			updated_at DATETIME,
			deleted_at DATETIME
		)`,
		`CREATE TABLE api_flow_runs (
			id TEXT PRIMARY KEY,
			flow_id TEXT NOT NULL,
			status TEXT NOT NULL DEFAULT 'pending',
			triggered_by TEXT NOT NULL,
			execution_mode TEXT NOT NULL DEFAULT 'server',
			source TEXT NOT NULL DEFAULT 'web',
			source_event_id TEXT NOT NULL DEFAULT '',
			profile TEXT NOT NULL DEFAULT '',
			environment TEXT NOT NULL DEFAULT '',
			base_url TEXT NOT NULL DEFAULT '',
			started_at DATETIME,
			finished_at DATETIME,
			created_at DATETIME,
			updated_at DATETIME,
			deleted_at DATETIME
		)`,
		`CREATE TABLE api_flow_step_results (
			id TEXT PRIMARY KEY,
			run_id TEXT NOT NULL,
			step_id TEXT NOT NULL,
			status TEXT NOT NULL DEFAULT 'pending',
			request TEXT,
			response TEXT,
			assert_results TEXT,
			duration_ms INTEGER DEFAULT 0,
			variables_captured TEXT,
			error_message TEXT,
			created_at DATETIME,
			updated_at DATETIME,
			deleted_at DATETIME
		)`,
	}
	for _, statement := range statements {
		require.NoError(t, db.Exec(statement).Error)
	}
}
