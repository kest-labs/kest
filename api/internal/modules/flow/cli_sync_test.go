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
	require.Equal(t, 1, flows[0].Revision)
	require.True(t, flows[0].Enabled)
	require.Equal(t, FlowParseStatusParsed, flows[0].ParseStatus)
	require.Equal(t, 2, flows[0].StepCount)

	detail, err := svc.GetFlow(context.Background(), flows[0].ID)
	require.NoError(t, err)
	require.True(t, detail.SourceReadOnly)
	require.Equal(t, 1, detail.Revision)
	require.True(t, detail.Enabled)
	require.Equal(t, FlowParseStatusParsed, detail.ParseStatus)
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
			RunnerType:   "server_ci",
			Profile:      "ci",
			Status:       "passed",
			TotalSteps:   1,
			PassedSteps:  1,
			DurationMs:   50,
			LogPath:      ".kest/logs/kest.log",
			LogContent:   "flow passed\nfull log",
			LogExcerpt:   "flow passed",
			LogTruncated: true,
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
	runs, err := svc.ListRuns(context.Background(), flows[0].ID, FlowRunListFilter{})
	require.NoError(t, err)
	require.Len(t, runs, 1)
	require.Equal(t, "cli", runs[0].ExecutionMode)
	require.Equal(t, "server_ci", runs[0].RunnerType)
	require.Equal(t, "ci", runs[0].Profile)
	require.Equal(t, 1, runs[0].TotalSteps)
	require.Equal(t, 1, runs[0].PassedSteps)
	require.Equal(t, int64(50), runs[0].DurationMs)
	require.Equal(t, ".kest/logs/kest.log", runs[0].LogPath)
	require.Equal(t, "flow passed\nfull log", runs[0].LogContent)
	require.Equal(t, "flow passed", runs[0].LogExcerpt)
	require.True(t, runs[0].LogTruncated)

	detail, err := svc.GetRun(context.Background(), runs[0].ID)
	require.NoError(t, err)
	require.Len(t, detail.StepResults, 1)
	require.Equal(t, "passed", detail.StepResults[0].Status)
	require.Equal(t, "flow passed", detail.LogExcerpt)

	ciRuns, err := svc.ListRuns(context.Background(), flows[0].ID, FlowRunListFilter{RunnerType: "server_ci", Status: "passed"})
	require.NoError(t, err)
	require.Len(t, ciRuns, 1)
	testMachineRuns, err := svc.ListRuns(context.Background(), flows[0].ID, FlowRunListFilter{RunnerType: "test_machine"})
	require.NoError(t, err)
	require.Empty(t, testMachineRuns)
}

func TestImportFlowMarkdownStoresDefinitionAndGraph(t *testing.T) {
	db := newFlowSyncTestDB(t)
	createFlowSyncTestTables(t, db)

	svc := NewService(NewRepository(db))
	definition := "```flow\n@flow id=auth-flow\n@name Auth Flow\n@tags auth, smoke\n```\n\n" +
		"```step\n@id login\n@name Login\nPOST /login\n[Headers]\nContent-Type: application/json\n\n{\"email\":\"a@example.com\"}\n[Asserts]\nstatus == 200\n```\n\n" +
		"```step\n@id profile\n@name Profile\nGET /profile\n```\n\n" +
		"```edge\n@from login\n@to profile\n@on success\n```"

	flow, err := svc.ImportFlowMarkdown(context.Background(), "workspace-1", "user-1", &ImportFlowMarkdownRequest{
		SourcePath: "flows/auth.flow.md",
		Definition: definition,
	})
	require.NoError(t, err)
	require.Equal(t, "Auth Flow", flow.Name)
	require.Equal(t, "auth-flow", flow.SourceID)
	require.Equal(t, "flows/auth.flow.md", flow.SourcePath)
	require.Equal(t, definition, flow.Definition)
	require.Equal(t, 1, flow.Revision)
	require.True(t, flow.Enabled)
	require.Equal(t, FlowParseStatusParsed, flow.ParseStatus)
	require.NotNil(t, flow.ParsedAt)
	require.Len(t, flow.Steps, 2)
	require.Len(t, flow.Edges, 1)
	require.Equal(t, "login", flow.Steps[0].ClientKey)
	require.Equal(t, "POST", flow.Steps[0].Method)
	require.Contains(t, flow.Steps[0].Headers, "Content-Type")
	require.Contains(t, flow.Steps[0].Asserts, "status == 200")
}

func TestUpdateFlowMarkdownStoresFailedParseAndClearsGraph(t *testing.T) {
	db := newFlowSyncTestDB(t)
	createFlowSyncTestTables(t, db)

	svc := NewService(NewRepository(db))
	flow, err := svc.ImportFlowMarkdown(context.Background(), "workspace-1", "user-1", &ImportFlowMarkdownRequest{
		Name:       "Auth",
		Definition: "```step\n@id login\nGET /login\n```",
	})
	require.NoError(t, err)
	require.Len(t, flow.Steps, 1)

	updated, err := svc.UpdateFlowMarkdown(context.Background(), flow.ID, &UpdateFlowMarkdownRequest{
		Definition: "```flow\nPOST /legacy\n```",
	})
	require.NoError(t, err)
	require.Equal(t, FlowParseStatusFailed, updated.ParseStatus)
	require.Contains(t, updated.ParseError, "at least one step")
	require.Equal(t, 2, updated.Revision)
	require.Empty(t, updated.Steps)
	require.Empty(t, updated.Edges)
}

func TestListRunnableFlowsForCLIReturnsEnabledParsedDefinitions(t *testing.T) {
	db := newFlowSyncTestDB(t)
	createFlowSyncTestTables(t, db)

	svc := NewService(NewRepository(db))
	enabled, err := svc.ImportFlowMarkdown(context.Background(), "workspace-1", "user-1", &ImportFlowMarkdownRequest{
		Definition: "```flow\n@flow id=enabled\n@name Enabled\n```\n```step\nGET /ok\n```",
	})
	require.NoError(t, err)
	_, err = svc.ImportFlowMarkdown(context.Background(), "workspace-1", "user-1", &ImportFlowMarkdownRequest{
		Definition: "```flow\n@flow id=disabled\n@name Disabled\n```\n```step\nGET /skip\n```",
		Enabled:    ptrBool(false),
	})
	require.NoError(t, err)

	flows, err := svc.ListRunnableFlowsForCLI(context.Background(), "workspace-1")
	require.NoError(t, err)
	require.Len(t, flows, 1)
	require.Equal(t, enabled.ID, flows[0].ID)
	require.Equal(t, "enabled", flows[0].SourceID)
	require.Contains(t, flows[0].Definition, "GET /ok")
}

func TestHandleCIWebhookReturnsServerRunCommand(t *testing.T) {
	db := newFlowSyncTestDB(t)
	createFlowSyncTestTables(t, db)

	svc := NewService(NewRepository(db))
	_, err := svc.ImportFlowMarkdown(context.Background(), "workspace-1", "user-1", &ImportFlowMarkdownRequest{
		Definition: "```flow\n@flow id=enabled\n@name Enabled\n```\n```step\nGET /ok\n```",
	})
	require.NoError(t, err)

	result, err := svc.HandleCIWebhook(context.Background(), "workspace-1", &CIWebhookRequest{
		EventID:   "build-123",
		Provider:  "github",
		Ref:       "refs/heads/main",
		CommitSHA: "abc123",
		BaseURL:   "https://staging.example.com",
	})
	require.NoError(t, err)
	require.True(t, result.Accepted)
	require.Equal(t, "server_ci", result.RunnerType)
	require.Equal(t, "ci", result.Profile)
	require.Equal(t, 1, result.RunnableFlowCount)
	require.Contains(t, result.Command, "kest run --workspace-flow all")
	require.Contains(t, result.Command, "--runner-type server_ci")
	require.Contains(t, result.Command, "--base-url 'https://staging.example.com'")
	require.Equal(t, "github", result.Metadata["provider"])
}

func ptrString(value string) *string {
	return &value
}

func ptrBool(value bool) *bool {
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
			definition TEXT,
			revision INTEGER NOT NULL DEFAULT 1,
			enabled NUMERIC NOT NULL DEFAULT true,
			metadata TEXT,
			parse_status TEXT NOT NULL DEFAULT 'unparsed',
			parse_error TEXT,
			parsed_at DATETIME,
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
			runner_type TEXT NOT NULL DEFAULT '',
			total_steps INTEGER NOT NULL DEFAULT 0,
			passed_steps INTEGER NOT NULL DEFAULT 0,
			failed_steps INTEGER NOT NULL DEFAULT 0,
			duration_ms INTEGER NOT NULL DEFAULT 0,
			error_message TEXT,
			log_content TEXT,
			log_path TEXT NOT NULL DEFAULT '',
			log_excerpt TEXT,
			log_truncated NUMERIC NOT NULL DEFAULT false,
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
