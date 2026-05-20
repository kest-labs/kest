package flow

import (
	"context"
	"testing"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func TestRepositoryListFlowsByWorkspace_UsesWorkspaceIDColumn(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to open sqlite db: %v", err)
	}

	if err := db.Exec(`
		CREATE TABLE api_flows (
			id TEXT PRIMARY KEY,
			workspace_id TEXT NOT NULL,
			name TEXT NOT NULL,
			description TEXT,
			created_by TEXT NOT NULL,
			created_at DATETIME,
			updated_at DATETIME,
			deleted_at DATETIME
		)
	`).Error; err != nil {
		t.Fatalf("failed to create api_flows table: %v", err)
	}

	insertSQL := `
		INSERT INTO api_flows (id, workspace_id, name, description, created_by, created_at, updated_at)
		VALUES (?, ?, ?, '', ?, datetime('now'), datetime('now'))
	`
	if err := db.Exec(insertSQL, "flow-1", "ws-1", "Flow 1", "user-1").Error; err != nil {
		t.Fatalf("failed to insert first flow: %v", err)
	}
	if err := db.Exec(insertSQL, "flow-2", "ws-2", "Flow 2", "user-2").Error; err != nil {
		t.Fatalf("failed to insert second flow: %v", err)
	}

	repo := NewRepository(db)
	flows, err := repo.ListFlowsByWorkspace(context.Background(), "ws-1")
	if err != nil {
		t.Fatalf("ListFlowsByWorkspace returned error: %v", err)
	}

	if len(flows) != 1 {
		t.Fatalf("expected 1 flow, got %d", len(flows))
	}
	if flows[0].ID != "flow-1" {
		t.Fatalf("expected flow-1, got %s", flows[0].ID)
	}
	if flows[0].WorkspaceID != "ws-1" {
		t.Fatalf("expected workspace_id ws-1, got %s", flows[0].WorkspaceID)
	}
}
