package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/kest-labs/kest/cli/internal/config"
	"github.com/kest-labs/kest/cli/internal/storage"
)

func TestBuildSpecSyncEndpoint(t *testing.T) {
	tests := []struct {
		name      string
		baseURL   string
		projectID string
		want      string
	}{
		{
			name:      "already versioned base path",
			baseURL:   "https://api.kest.dev/v1",
			projectID: "12",
			want:      "https://api.kest.dev/v1/workspaces/12/cli/spec-sync",
		},
		{
			name:      "already versioned api path",
			baseURL:   "https://api.kest.dev/api/v1/",
			projectID: "12",
			want:      "https://api.kest.dev/api/v1/workspaces/12/cli/spec-sync",
		},
		{
			name:      "plain origin",
			baseURL:   "https://api.kest.dev",
			projectID: "12",
			want:      "https://api.kest.dev/v1/workspaces/12/cli/spec-sync",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := buildSpecSyncEndpoint(tt.baseURL, tt.projectID); got != tt.want {
				t.Fatalf("expected %q, got %q", tt.want, got)
			}
		})
	}
}

func TestParseSyncResponse(t *testing.T) {
	t.Run("wrapped api response", func(t *testing.T) {
		body := []byte(`{"code":0,"message":"success","data":{"created":1,"updated":2,"skipped":3,"errors":["x"]}}`)
		got, err := parseSyncResponse(body)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if got.Created != 1 || got.Updated != 2 || got.Skipped != 3 || len(got.Errors) != 1 {
			t.Fatalf("unexpected response: %+v", got)
		}
	})

	t.Run("flat response", func(t *testing.T) {
		body := []byte(`{"created":4,"updated":5,"skipped":6}`)
		got, err := parseSyncResponse(body)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if got.Created != 4 || got.Updated != 5 || got.Skipped != 6 {
			t.Fatalf("unexpected response: %+v", got)
		}
	})
}

func TestBuildHistorySyncEntriesStableAndSanitized(t *testing.T) {
	record := storage.Record{
		ID:              42,
		Method:          "POST",
		URL:             "https://example.com/login",
		Path:            "/login",
		QueryParams:     json.RawMessage(`{"token":["secret"],"page":["1"]}`),
		RequestHeaders:  json.RawMessage(`{"Authorization":"Bearer secret","X-Trace":"ok"}`),
		RequestBody:     `{"password":"secret","name":"demo"}`,
		ResponseStatus:  201,
		ResponseHeaders: json.RawMessage(`{"Set-Cookie":["session=secret"]}`),
		ResponseBody:    `{"access_token":"secret-token","ok":true}`,
		DurationMs:      123,
		Project:         "local-project",
		CreatedAt:       time.Unix(1700000000, 0).UTC(),
	}

	first := buildHistorySyncEntries([]storage.Record{record}, "client-1")
	second := buildHistorySyncEntries([]storage.Record{record}, "client-1")

	if len(first) != 1 || len(second) != 1 {
		t.Fatalf("expected one entry, got %d and %d", len(first), len(second))
	}
	if first[0].SourceEventID != "client-1:record:42" {
		t.Fatalf("unexpected source event id %q", first[0].SourceEventID)
	}
	if first[0].SourceEventID != second[0].SourceEventID {
		t.Fatalf("expected stable source event ids, got %q and %q", first[0].SourceEventID, second[0].SourceEventID)
	}

	payload, err := json.Marshal(first[0].Data)
	if err != nil {
		t.Fatalf("marshal history data: %v", err)
	}
	payloadText := string(payload)
	if !strings.Contains(payloadText, "[REDACTED]") {
		t.Fatalf("expected sensitive fields to be redacted, got %s", payloadText)
	}
	if strings.Contains(payloadText, "Bearer secret") ||
		strings.Contains(payloadText, "session=secret") ||
		strings.Contains(payloadText, "secret-token") ||
		strings.Contains(payloadText, `"password":"secret"`) {
		t.Fatalf("expected sensitive values to be removed, got %s", payloadText)
	}
}

func TestRunSyncHistoryDryRunDoesNotUploadOrMutateOutbox(t *testing.T) {
	t.Setenv("HOME", t.TempDir())
	projectDir := filepath.Join(t.TempDir(), "local-project")
	if err := os.MkdirAll(filepath.Join(projectDir, ".kest"), 0755); err != nil {
		t.Fatalf("mkdir project: %v", err)
	}
	oldWd, err := os.Getwd()
	if err != nil {
		t.Fatalf("Getwd returned error: %v", err)
	}
	if err := os.Chdir(projectDir); err != nil {
		t.Fatalf("Chdir returned error: %v", err)
	}
	defer func() {
		if err := os.Chdir(oldWd); err != nil {
			t.Fatalf("restore cwd: %v", err)
		}
	}()

	store, err := storage.NewStore()
	if err != nil {
		t.Fatalf("NewStore returned error: %v", err)
	}
	recordID, err := store.SaveRecord(&storage.Record{
		Method:         "GET",
		URL:            "https://example.com/health",
		Path:           "/health",
		ResponseStatus: 200,
		Project:        "local-project",
		CreatedAt:      time.Now().UTC(),
	})
	if err != nil {
		t.Fatalf("SaveRecord returned error: %v", err)
	}
	if recordID == 0 {
		t.Fatal("expected record id")
	}
	defer store.Close()

	conf := &config.Config{
		PlatformURL:       "http://127.0.0.1:1/v1",
		PlatformToken:     "kest_pat_test",
		PlatformWorkspaceID: "12",
	}
	if err := config.SaveConfig(conf); err != nil {
		t.Fatalf("SaveConfig returned error: %v", err)
	}

	oldLimit, oldDryRun, oldSince, oldAll := syncHistoryLimit, syncHistoryDryRun, syncHistorySince, syncHistoryAll
	syncHistoryLimit = 10
	syncHistoryDryRun = true
	syncHistorySince = ""
	syncHistoryAll = false
	defer func() {
		syncHistoryLimit = oldLimit
		syncHistoryDryRun = oldDryRun
		syncHistorySince = oldSince
		syncHistoryAll = oldAll
	}()

	if err := runSyncHistory(); err != nil {
		t.Fatalf("runSyncHistory returned error: %v", err)
	}

	items, err := store.ListDueSyncOutbox("history", "local-project", "12", 10)
	if err != nil {
		t.Fatalf("ListDueSyncOutbox returned error: %v", err)
	}
	if len(items) != 0 {
		t.Fatalf("expected dry-run not to mutate outbox, got %d item(s)", len(items))
	}
	clientID, err := store.GetSyncMeta("client_id")
	if err != nil {
		t.Fatalf("GetSyncMeta returned error: %v", err)
	}
	if clientID != "" {
		t.Fatalf("expected dry-run not to create sync client id, got %q", clientID)
	}
}
