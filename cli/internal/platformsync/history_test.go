package platformsync

import (
	"encoding/json"
	"strings"
	"testing"
	"time"

	"github.com/kest-labs/kest/cli/internal/config"
	"github.com/kest-labs/kest/cli/internal/storage"
	"github.com/kest-labs/kest/cli/internal/summary"
)

func TestSanitizeBodyRedactsAndTruncates(t *testing.T) {
	value, truncated := SanitizeBody(`{"token":"secret-token","name":"demo"}`)
	if !strings.Contains(value, "[REDACTED]") {
		t.Fatalf("expected token to be redacted, got %s", value)
	}
	if truncated {
		t.Fatalf("did not expect short payload to be truncated")
	}

	longValue, wasTruncated := SanitizeLogExcerpt(strings.Repeat("x", DefaultLogLimit+20))
	if !wasTruncated {
		t.Fatal("expected long log excerpt to be truncated")
	}
	if len(longValue) > DefaultLogLimit {
		t.Fatalf("expected truncated log length <= %d, got %d", DefaultLogLimit, len(longValue))
	}
}

func TestQueueRequestHistoryEnqueuesSanitizedEntry(t *testing.T) {
	t.Setenv("HOME", t.TempDir())

	store, err := storage.NewStore()
	if err != nil {
		t.Fatalf("NewStore returned error: %v", err)
	}
	defer store.Close()

	conf := &config.Config{
		ProjectID:               "local-project",
		PlatformProjectID:       "platform-1",
		PlatformURL:             "https://api.kest.dev/v1",
		PlatformToken:           "kest_pat_test",
		PlatformAutoSyncHistory: true,
	}

	record := &storage.Record{
		ID:              42,
		Method:          "GET",
		URL:             "https://example.com/api/users?token=secret",
		Path:            "/api/users",
		QueryParams:     json.RawMessage(`{"token":["secret"],"page":["1"]}`),
		RequestHeaders:  json.RawMessage(`{"Authorization":"Bearer secret","X-Trace":"ok"}`),
		RequestBody:     `{"password":"top-secret","name":"demo"}`,
		ResponseStatus:  200,
		ResponseHeaders: json.RawMessage(`{"Set-Cookie":["secret=1"],"Content-Type":["application/json"]}`),
		ResponseBody:    `{"access_token":"secret-token","status":"ok"}`,
		DurationMs:      123,
		Environment:     "dev",
		Project:         "local-project",
		CreatedAt:       time.Unix(1700000000, 0).UTC(),
	}

	if err := QueueRequestHistory(conf, store, record, "get"); err != nil {
		t.Fatalf("QueueRequestHistory returned error: %v", err)
	}

	items, err := store.ListDueSyncOutbox(HistorySyncKind, conf.ProjectID, conf.PlatformProjectID, 10)
	if err != nil {
		t.Fatalf("ListDueSyncOutbox returned error: %v", err)
	}
	if len(items) != 1 {
		t.Fatalf("expected one outbox item, got %d", len(items))
	}

	var entry HistorySyncEntry
	if err := json.Unmarshal([]byte(items[0].EntryPayload), &entry); err != nil {
		t.Fatalf("failed to decode outbox payload: %v", err)
	}
	if !strings.HasSuffix(entry.SourceEventID, ":record:42") {
		t.Fatalf("unexpected source event id %q", entry.SourceEventID)
	}

	requestRecord := entry.Data["request"].(map[string]interface{})
	responseRecord := entry.Data["response"].(map[string]interface{})
	requestHeaders := requestRecord["headers"].(map[string]interface{})
	responseHeaders := responseRecord["headers"].(map[string]interface{})

	if requestHeaders["Authorization"] != "[REDACTED]" {
		t.Fatalf("expected Authorization header redacted, got %#v", requestHeaders["Authorization"])
	}
	if responseHeaders["Set-Cookie"].([]interface{})[0] != "[REDACTED]" {
		t.Fatalf("expected Set-Cookie redacted, got %#v", responseHeaders["Set-Cookie"])
	}
	if body := requestRecord["body"].(string); !strings.Contains(body, "[REDACTED]") {
		t.Fatalf("expected request body redacted, got %s", body)
	}
	if body := responseRecord["body"].(string); !strings.Contains(body, "[REDACTED]") {
		t.Fatalf("expected response body redacted, got %s", body)
	}
}

func TestQueueRunHistoryEnqueuesAggregateEvent(t *testing.T) {
	t.Setenv("HOME", t.TempDir())

	store, err := storage.NewStore()
	if err != nil {
		t.Fatalf("NewStore returned error: %v", err)
	}
	defer store.Close()

	conf := &config.Config{
		ProjectID:               "local-project",
		PlatformProjectID:       "platform-1",
		PlatformURL:             "https://api.kest.dev/v1",
		PlatformToken:           "kest_pat_test",
		PlatformAutoSyncHistory: true,
	}

	summ := summary.NewSummary()
	summ.StartTime = time.Unix(1700001000, 0).UTC()
	summ.AddResult(summary.TestResult{
		Name:         "login",
		Method:       "POST",
		URL:          "/api/login",
		RequestBody:  `{"password":"secret"}`,
		ResponseBody: `{"token":"secret"}`,
		Duration:     150 * time.Millisecond,
		Success:      true,
		StartTime:    summ.StartTime,
	})

	if err := QueueRunHistory(conf, store, "auth.flow.md", summ, ""); err != nil {
		t.Fatalf("QueueRunHistory returned error: %v", err)
	}

	items, err := store.ListDueSyncOutbox(HistorySyncKind, conf.ProjectID, conf.PlatformProjectID, 10)
	if err != nil {
		t.Fatalf("ListDueSyncOutbox returned error: %v", err)
	}
	if len(items) != 1 {
		t.Fatalf("expected one outbox item, got %d", len(items))
	}

	var entry HistorySyncEntry
	if err := json.Unmarshal([]byte(items[0].EntryPayload), &entry); err != nil {
		t.Fatalf("failed to decode outbox payload: %v", err)
	}
	if entry.EntityType != "cli_run" {
		t.Fatalf("expected cli_run entity type, got %q", entry.EntityType)
	}

	runRecord := entry.Data["run"].(map[string]interface{})
	if runRecord["source_name"] != "auth.flow.md" {
		t.Fatalf("expected source name auth.flow.md, got %#v", runRecord["source_name"])
	}

	results := entry.Data["results"].([]interface{})
	if len(results) != 1 {
		t.Fatalf("expected one step result, got %d", len(results))
	}
	first := results[0].(map[string]interface{})
	if body := first["response_body"].(string); !strings.Contains(body, "[REDACTED]") {
		t.Fatalf("expected response body redacted, got %s", body)
	}
}
