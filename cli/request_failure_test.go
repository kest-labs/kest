package main

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/kest-labs/kest/cli/internal/output"
	"github.com/kest-labs/kest/cli/internal/storage"
)

// deadURL returns a URL whose server has been shut down, so requests to it
// fail with "connection refused".
func deadURL(t *testing.T) string {
	t.Helper()
	server := httptest.NewServer(http.NotFoundHandler())
	u := server.URL
	server.Close()
	return u
}

func lastRecord(t *testing.T) *storage.Record {
	t.Helper()
	store, err := storage.NewStore()
	if err != nil {
		t.Fatal(err)
	}
	defer store.Close()
	rec, err := store.GetLastRecord()
	if err != nil {
		t.Fatal(err)
	}
	return rec
}

func TestNetworkErrorIsSavedToHistory(t *testing.T) {
	isolateKest(t)
	target := deadURL(t) + "/login"

	tr, err := ExecuteRequest(RequestOptions{
		Method:       "post",
		URL:          target,
		Headers:      []string{"X-Trace: abc"},
		Data:         `{"user":"alice"}`,
		SilentOutput: true,
	})
	var exitErr *ExitError
	if !errors.As(err, &exitErr) || exitErr.Code != ExitRuntimeError {
		t.Fatalf("expected runtime error, got %v", err)
	}
	if tr.ErrorKind != output.ErrorKindNetwork {
		t.Fatalf("error kind = %q, want network", tr.ErrorKind)
	}
	if tr.RecordID == 0 {
		t.Fatal("network failure was not saved to history")
	}

	rec := lastRecord(t)
	if rec.ID != tr.RecordID || rec.Method != "POST" || rec.URL != target || rec.Path != "/login" {
		t.Fatalf("unexpected record: #%d %s %s path=%q", rec.ID, rec.Method, rec.URL, rec.Path)
	}
	if rec.ResponseStatus != 0 {
		t.Fatalf("status = %d, want 0", rec.ResponseStatus)
	}
	if rec.RequestBody != `{"user":"alice"}` || !strings.Contains(string(rec.RequestHeaders), "X-Trace") {
		t.Fatalf("request not preserved: headers=%s body=%q", rec.RequestHeaders, rec.RequestBody)
	}
	if !strings.Contains(rec.Failure, "connection refused") {
		t.Fatalf("failure = %q, want connection refused", rec.Failure)
	}

	prompt := buildWhyPrompt(rec, nil)
	for _, want := range []string{"no HTTP response was received", "Kest failure:", "connection refused"} {
		if !strings.Contains(prompt, want) {
			t.Fatalf("why prompt missing %q:\n%s", want, prompt)
		}
	}

	res := buildHistoryResult([]storage.Record{*rec})
	entries := res.Data.(map[string]any)["records"].([]historyEntry)
	if entries[0].Status != 0 || !strings.Contains(entries[0].Failure, "connection refused") {
		t.Fatalf("history entry = %+v", entries[0])
	}
	if historyStatusCell(0) != "ERR" || historyStatusCell(404) != "404" {
		t.Fatal("unexpected history status cell")
	}
}

func TestNetworkErrorRespectsNoRecord(t *testing.T) {
	isolateKest(t)
	tr, err := ExecuteRequest(RequestOptions{Method: "get", URL: deadURL(t) + "/x", NoRecord: true, SilentOutput: true})
	if err == nil {
		t.Fatal("expected error")
	}
	if tr.RecordID != 0 {
		t.Fatalf("record saved despite --no-record: %d", tr.RecordID)
	}
	store, err := storage.NewStore()
	if err != nil {
		t.Fatal(err)
	}
	defer store.Close()
	if _, err := store.GetLastRecord(); err == nil {
		t.Fatal("history should be empty")
	}
}

func TestTimeoutIsSavedToHistory(t *testing.T) {
	isolateKest(t)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(300 * time.Millisecond)
	}))
	t.Cleanup(server.Close)

	tr, err := ExecuteRequest(RequestOptions{Method: "get", URL: server.URL + "/slow", MaxDuration: 50, SilentOutput: true})
	if err == nil {
		t.Fatal("expected timeout")
	}
	if tr.ErrorKind != output.ErrorKindTimeout {
		t.Fatalf("error kind = %q, want timeout", tr.ErrorKind)
	}
	rec := lastRecord(t)
	if rec.ID != tr.RecordID || rec.ResponseStatus != 0 || rec.Failure == "" {
		t.Fatalf("timeout not recorded: %+v", rec)
	}
}

func TestReplayOfNetworkFailureRecord(t *testing.T) {
	isolateKest(t)
	server := newAPIServer(t)

	// A request that failed earlier (status 0) replays fine once the
	// server is up.
	store, err := storage.NewStore()
	if err != nil {
		t.Fatal(err)
	}
	id, err := store.SaveRecord(&storage.Record{
		Method: "GET", URL: server.URL + "/health", Path: "/health",
		RequestHeaders: []byte(`{}`), ResponseHeaders: []byte(`{}`),
		Failure: "connection refused", CreatedAt: time.Now().UTC(),
	})
	store.Close()
	if err != nil {
		t.Fatal(err)
	}
	res, err := replayRecord("last", nil, true)
	if err != nil {
		t.Fatalf("replay failed: %v", err)
	}
	if res.Diff == nil || res.Diff.StatusBefore != 0 || res.Diff.StatusAfter != 200 {
		t.Fatalf("unexpected diff: %+v", res.Diff)
	}
	if rec := lastRecord(t); rec.ID == id || rec.ResponseStatus != 200 || rec.Failure != "" {
		t.Fatalf("replay record = %+v", rec)
	}

	// Replaying against a dead server records the new failure.
	store, err = storage.NewStore()
	if err != nil {
		t.Fatal(err)
	}
	_, _ = store.SaveRecord(&storage.Record{
		Method: "GET", URL: deadURL(t) + "/health", RequestHeaders: []byte(`{}`),
		ResponseHeaders: []byte(`{}`), ResponseStatus: 200, CreatedAt: time.Now().UTC(),
	})
	store.Close()
	if _, err := replayRecord("last", nil, false); err == nil {
		t.Fatal("expected replay to fail")
	}
	if rec := lastRecord(t); rec.ResponseStatus != 0 || !strings.Contains(rec.Failure, "connection refused") {
		t.Fatalf("failed replay not recorded: %+v", rec)
	}
}
