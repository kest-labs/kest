package history

import (
	"context"
	"testing"
	"time"

	"github.com/kest-labs/kest/api/internal/infra/database"
)

func TestSyncHistoryFromCLIIsIdempotent(t *testing.T) {
	db, err := database.NewTestDB()
	if err != nil {
		t.Fatalf("NewTestDB returned error: %v", err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatalf("db.DB returned error: %v", err)
	}
	sqlDB.SetMaxOpenConns(1)
	sqlDB.SetMaxIdleConns(1)

	if err := db.Exec(`
		CREATE TABLE history (
			id TEXT PRIMARY KEY,
			entity_type TEXT NOT NULL,
			entity_id TEXT NOT NULL,
			project_id TEXT NOT NULL,
			user_id TEXT NOT NULL,
			source TEXT NOT NULL DEFAULT 'web',
			source_event_id TEXT NOT NULL,
			action TEXT NOT NULL,
			data TEXT,
			diff TEXT,
			message TEXT,
			created_at DATETIME,
			updated_at DATETIME,
			deleted_at DATETIME
		);
		CREATE UNIQUE INDEX idx_history_project_source_event
			ON history(project_id, source, source_event_id)
	`).Error; err != nil {
		t.Fatalf("create history schema returned error: %v", err)
	}

	repo := NewRepository(db)
	svc := NewService(repo)
	req := &CLIHistorySyncInput{
		Source: "cli",
		Entries: []CLIHistorySyncEntryInput{
			{
				SourceEventID: "client-1:record:42",
				EventType:     "cli_request",
				OccurredAt:    time.Unix(1700000000, 0).UTC(),
				EntityType:    "cli_request",
				EntityID:      "42",
				Action:        "run",
				Message:       "GET /api/users -> 200",
				Data: map[string]interface{}{
					"request": map[string]interface{}{
						"method": "GET",
						"url":    "https://example.com/api/users",
					},
				},
			},
		},
	}

	first, err := svc.SyncHistoryFromCLI(context.Background(), "project-1", "7", req)
	if err != nil {
		t.Fatalf("SyncHistoryFromCLI returned error: %v", err)
	}
	if first.Created != 1 || first.Skipped != 0 {
		t.Fatalf("expected first sync to create one record, got %+v", first)
	}

	second, err := svc.SyncHistoryFromCLI(context.Background(), "project-1", "7", req)
	if err != nil {
		t.Fatalf("SyncHistoryFromCLI second call returned error: %v", err)
	}
	if second.Created != 0 || second.Skipped != 1 {
		t.Fatalf("expected second sync to skip duplicate record, got %+v", second)
	}

	record, err := repo.GetBySourceEvent(context.Background(), "project-1", "cli", "client-1:record:42")
	if err != nil {
		t.Fatalf("GetBySourceEvent returned error: %v", err)
	}
	if record == nil {
		t.Fatal("expected synced history record to exist")
	}
	if record.Source != "cli" {
		t.Fatalf("expected source cli, got %q", record.Source)
	}
	if !record.CreatedAt.Equal(time.Unix(1700000000, 0).UTC()) {
		t.Fatalf("expected created_at to match occurred_at, got %s", record.CreatedAt)
	}
}
