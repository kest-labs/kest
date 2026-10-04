package main

import (
	"errors"
	"strings"
	"testing"

	"github.com/kest-labs/kest/cli/internal/storage"
)

func TestFailedAssertionIsSavedForWhy(t *testing.T) {
	isolateKest(t)
	server := newAPIServer(t)

	tr, err := ExecuteRequest(RequestOptions{
		Method:       "get",
		URL:          server.URL + "/health",
		Asserts:      []string{"status == 201"},
		SilentOutput: true,
	})
	var exitErr *ExitError
	if !errors.As(err, &exitErr) || exitErr.Code != ExitAssertionFailed {
		t.Fatalf("expected assertion failure, got %v", err)
	}
	if tr.RecordID == 0 {
		t.Fatal("failed request was not saved to history")
	}

	store, err := storage.NewStore()
	if err != nil {
		t.Fatal(err)
	}
	defer store.Close()
	last, err := store.GetLastRecord()
	if err != nil {
		t.Fatal(err)
	}
	if last.ID != tr.RecordID || last.ResponseStatus != 200 {
		t.Fatalf("last record = #%d status %d, want #%d status 200", last.ID, last.ResponseStatus, tr.RecordID)
	}
	if !strings.Contains(last.Failure, "status == 201") {
		t.Fatalf("failure reason not stored: %q", last.Failure)
	}

	prompt := buildWhyPrompt(last, nil)
	if !strings.Contains(prompt, "Kest failure: assertion failed: status == 201") {
		t.Fatalf("why prompt does not explain the failure:\n%s", prompt)
	}
}

func TestPassingRequestHasNoFailure(t *testing.T) {
	isolateKest(t)
	server := newAPIServer(t)

	tr, err := ExecuteRequest(RequestOptions{
		Method: "get", URL: server.URL + "/health", Asserts: []string{"status == 200"}, SilentOutput: true,
	})
	if err != nil {
		t.Fatal(err)
	}
	store, err := storage.NewStore()
	if err != nil {
		t.Fatal(err)
	}
	defer store.Close()
	rec, err := store.GetRecord(tr.RecordID)
	if err != nil {
		t.Fatal(err)
	}
	if rec.Failure != "" {
		t.Fatalf("passing request has failure %q", rec.Failure)
	}
	if strings.Contains(buildWhyPrompt(rec, nil), "Kest failure") {
		t.Fatal("why prompt reports a failure for a passing request")
	}
}

func TestWhyPromptRedactsSecrets(t *testing.T) {
	rec := &storage.Record{
		ID: 1, Method: "POST", URL: "https://api.test/login",
		RequestHeaders: []byte(`{"Authorization":"Bearer super-secret-token-value","Cookie":"sid=abc123","Accept":"application/json"}`),
		RequestBody:    `{"user":"alice","password":"hunter2"}`,
		ResponseBody:   `{"access_token":"leaked-secret"}`,
	}
	prompt := buildWhyPrompt(rec, nil)
	for _, secret := range []string{"super-secret-token-value", "Bearer super", "abc123", "hunter2", "leaked-secret"} {
		if strings.Contains(prompt, secret) {
			t.Fatalf("prompt leaks %q:\n%s", secret, prompt)
		}
	}
	if !strings.Contains(prompt, "Accept: application/json") || !strings.Contains(prompt, "alice") {
		t.Fatalf("prompt lost non-secret context:\n%s", prompt)
	}
}
