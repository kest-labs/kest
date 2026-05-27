package project

import (
	"context"
	"fmt"
	"testing"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func TestRepositoryDeleteCascadesProjectData(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to open sqlite db: %v", err)
	}

	statements := []string{
		`CREATE TABLE projects (id TEXT PRIMARY KEY)`,
		`CREATE TABLE project_members (project_id TEXT)`,
		`CREATE TABLE workspace_cli_tokens (workspace_id TEXT)`,
		`CREATE TABLE project_invitations (project_id TEXT)`,
		`CREATE TABLE api_specs (id TEXT PRIMARY KEY, workspace_id TEXT)`,
		`CREATE TABLE api_examples (api_spec_id TEXT)`,
		`CREATE TABLE api_spec_shares (workspace_id TEXT)`,
		`CREATE TABLE api_spec_ai_drafts (workspace_id TEXT)`,
		`CREATE TABLE api_flows (id TEXT PRIMARY KEY, project_id TEXT)`,
		`CREATE TABLE api_flow_steps (flow_id TEXT)`,
		`CREATE TABLE api_flow_edges (flow_id TEXT)`,
		`CREATE TABLE api_flow_runs (id TEXT PRIMARY KEY, flow_id TEXT)`,
		`CREATE TABLE api_flow_step_results (run_id TEXT)`,
		`CREATE TABLE test_cases (id TEXT PRIMARY KEY, api_spec_id TEXT)`,
		`CREATE TABLE test_runs (test_case_id TEXT)`,
		`CREATE TABLE audit_logs (project_id TEXT)`,
	}

	for _, statement := range statements {
		if err := db.Exec(statement).Error; err != nil {
			t.Fatalf("failed to create schema with %q: %v", statement, err)
		}
	}

	projectID := "project-1"
	workspaceID := "workspace-1"
	specID := "spec-1"
	flowID := "flow-1"
	runID := "run-1"
	testCaseID := "tc-1"

	inserts := []string{
		fmt.Sprintf(`INSERT INTO projects (id) VALUES ('%s')`, projectID),
		fmt.Sprintf(`INSERT INTO project_members (project_id) VALUES ('%s')`, projectID),
		fmt.Sprintf(`INSERT INTO workspace_cli_tokens (workspace_id) VALUES ('%s')`, workspaceID),
		fmt.Sprintf(`INSERT INTO project_invitations (project_id) VALUES ('%s')`, projectID),
		fmt.Sprintf(`INSERT INTO api_specs (id, workspace_id) VALUES ('%s', '%s')`, specID, workspaceID),
		fmt.Sprintf(`INSERT INTO api_examples (api_spec_id) VALUES ('%s')`, specID),
		fmt.Sprintf(`INSERT INTO api_spec_shares (workspace_id) VALUES ('%s')`, workspaceID),
		fmt.Sprintf(`INSERT INTO api_spec_ai_drafts (workspace_id) VALUES ('%s')`, workspaceID),
		fmt.Sprintf(`INSERT INTO api_flows (id, project_id) VALUES ('%s', '%s')`, flowID, projectID),
		fmt.Sprintf(`INSERT INTO api_flow_steps (flow_id) VALUES ('%s')`, flowID),
		fmt.Sprintf(`INSERT INTO api_flow_edges (flow_id) VALUES ('%s')`, flowID),
		fmt.Sprintf(`INSERT INTO api_flow_runs (id, flow_id) VALUES ('%s', '%s')`, runID, flowID),
		fmt.Sprintf(`INSERT INTO api_flow_step_results (run_id) VALUES ('%s')`, runID),
		fmt.Sprintf(`INSERT INTO test_cases (id, api_spec_id) VALUES ('%s', '%s')`, testCaseID, specID),
		fmt.Sprintf(`INSERT INTO test_runs (test_case_id) VALUES ('%s')`, testCaseID),
		fmt.Sprintf(`INSERT INTO audit_logs (project_id) VALUES ('%s')`, projectID),
	}

	for _, statement := range inserts {
		if err := db.Exec(statement).Error; err != nil {
			t.Fatalf("failed to seed data with %q: %v", statement, err)
		}
	}

	repo := NewRepository(db)
	if err := repo.Delete(context.Background(), projectID); err != nil {
		t.Fatalf("Delete returned error: %v", err)
	}

	assertCountZero := func(table string, where string, args ...any) {
		t.Helper()

		var count int64
		query := db.Table(table)
		if where != "" {
			query = query.Where(where, args...)
		}
		if err := query.Count(&count).Error; err != nil {
			t.Fatalf("failed to count rows in %s: %v", table, err)
		}
		if count != 0 {
			t.Fatalf("expected %s to be empty, got %d rows", table, count)
		}
	}

	for _, table := range []string{
		"projects",
		"project_members",
		"project_invitations",
		"api_flows",
		"api_flow_steps",
		"api_flow_edges",
		"api_flow_runs",
		"api_flow_step_results",
		"audit_logs",
	} {
		assertCountZero(table, "")
	}

	for _, table := range []string{
		"api_specs",
		"api_examples",
		"api_spec_shares",
		"api_spec_ai_drafts",
		"workspace_cli_tokens",
		"test_cases",
		"test_runs",
	} {
		var count int64
		if err := db.Table(table).Count(&count).Error; err != nil {
			t.Fatalf("failed to count preserved rows in %s: %v", table, err)
		}
		if count != 1 {
			t.Fatalf("expected %s to preserve 1 workspace-scoped row, got %d", table, count)
		}
	}
}

func TestRepositoryDeleteSkipsMissingOptionalTables(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to open sqlite db: %v", err)
	}

	if err := db.Exec(`CREATE TABLE projects (id TEXT PRIMARY KEY)`).Error; err != nil {
		t.Fatalf("failed to create projects table: %v", err)
	}
	if err := db.Exec(`INSERT INTO projects (id) VALUES ('project-1')`).Error; err != nil {
		t.Fatalf("failed to seed project: %v", err)
	}

	repo := NewRepository(db)
	if err := repo.Delete(context.Background(), "project-1"); err != nil {
		t.Fatalf("Delete returned error: %v", err)
	}

	var count int64
	if err := db.Table("projects").Count(&count).Error; err != nil {
		t.Fatalf("failed to count projects: %v", err)
	}
	if count != 0 {
		t.Fatalf("expected project row to be removed, got %d rows", count)
	}
}
