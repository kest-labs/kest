package main

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/kest-labs/kest/cli/internal/output"
)

// teardownFlow creates an item, runs two steps and deletes the item in two
// ordered teardown steps. failStep makes the "use" step fail its assertion.
func teardownFlow(failStep bool) string {
	useAssert := "status == 200"
	if failStep {
		useAssert = "status == 201"
	}
	var b strings.Builder
	b.WriteString("```flow\n@flow id=td\n@name Teardown\n```\n\n")
	b.WriteString(flowStep("create", "Create item", "POST /items", createCaptures))
	b.WriteString(flowStep("use", "Use item", "GET /items/{{item_id}}", "\n[Asserts]\n"+useAssert+"\n"))
	b.WriteString(flowStep("after", "After", "GET /health", "\n[Asserts]\nstatus == 200\n"))
	b.WriteString("```teardown\n@id cleanup-a\n@name Delete item\nDELETE /items/{{item_id}}\n\n[Asserts]\nstatus == 200\n```\n\n")
	b.WriteString("```teardown\n@id cleanup-b\n@name Audit cleanup\nGET /health\n\n[Asserts]\nstatus == 200\n```\n")
	return b.String()
}

func TestTeardownRunsAfterFailFast(t *testing.T) {
	server, log := newResourceServer(t, http.StatusCreated, "")
	res, _, err := runFlowResultWith(t, teardownFlow(true), server.URL, func() { runFailFast = true })
	if err == nil {
		t.Fatal("expected a failing run")
	}
	// The run stopped at "use": "after" never ran, teardown still did.
	if log.count("DELETE /items/item-42") != 1 {
		t.Fatalf("teardown delete must run with --fail-fast, hits=%v", log.hits)
	}
	if s := stepByID(t, res, "cleanup-a"); s.Outcome != output.OutcomePassed || s.Phase != phaseTeardown {
		t.Fatalf("teardown step should pass, got %+v", s)
	}
	for _, s := range res.Steps {
		if s.StepID == "after" {
			t.Fatalf("--fail-fast should not have run %q", s.StepID)
		}
	}
	if res.Summary.Failed != 1 || res.Summary.Skipped != 1 {
		t.Fatalf("unexpected summary %+v", res.Summary)
	}
}

func TestTeardownRunsInDeclaredOrderAfterFailure(t *testing.T) {
	server, log := newResourceServer(t, http.StatusCreated, "")
	_, _, err := runFlowResult(t, teardownFlow(true), server.URL)
	if err == nil {
		t.Fatal("expected a failing run")
	}
	tail := log.hits[len(log.hits)-2:]
	if tail[0] != "DELETE /items/item-42" || tail[1] != "GET /health" {
		t.Fatalf("teardown order wrong: %v", log.hits)
	}
}

func TestTeardownSkippedWhenCreateFailedWithFailFast(t *testing.T) {
	server, log := newResourceServer(t, http.StatusInternalServerError, "")
	res, _, _ := runFlowResultWith(t, teardownFlow(false), server.URL, func() { runFailFast = true })
	s := stepByID(t, res, "cleanup-a")
	if s.Outcome != output.OutcomeSkipped || s.SkippedBecause != "create" || !strings.Contains(s.SkipReason, "Create item") {
		t.Fatalf("teardown delete should be skipped because create failed, got %+v", s)
	}
	if log.count("DELETE") != 0 {
		t.Fatalf("delete must not run without an id: %v", log.hits)
	}
	// The variable-free teardown step still runs.
	if b := stepByID(t, res, "cleanup-b"); b.Outcome != output.OutcomePassed {
		t.Fatalf("independent teardown step should run, got %+v", b)
	}
}

func TestTeardownSkippedWhenStaleVariableOnly(t *testing.T) {
	// A value left in local storage by an earlier run must not be used to
	// delete something when this run never created it.
	good, _ := newResourceServer(t, http.StatusCreated, "")
	server, log := newResourceServer(t, http.StatusInternalServerError, "")
	work := isolateKest(t)
	if _, _, err := runFlowIn(t, work, flowStep("create", "Create item", "POST /items", createCaptures), good.URL); err != nil {
		t.Fatalf("seed run failed: %v", err)
	}
	res, _, _ := runFlowIn(t, work, teardownFlow(false), server.URL)
	if s := stepByID(t, res, "cleanup-a"); s.Outcome != output.OutcomeSkipped {
		t.Fatalf("expected skipped teardown, got %+v", s)
	}
	if log.count("DELETE") != 0 {
		t.Fatalf("stale variable was used: %v", log.hits)
	}
}

func TestFailingTeardownDoesNotHideOriginalFailure(t *testing.T) {
	server, _ := newResourceServer(t, http.StatusCreated, "/items/item-42")
	res, _, err := runFlowResult(t, teardownFlow(true), server.URL)
	var exitErr *ExitError
	if !errors.As(err, &exitErr) || exitErr.Code != ExitAssertionFailed {
		t.Fatalf("exit code should come from the original assertion failure, got %v", err)
	}
	if failure := res.FirstFailure(); failure == nil || failure.Kind != output.ErrorKindAssertion {
		t.Fatalf("first failure must be the original one, got %+v", failure)
	}
	cleanup := stepByID(t, res, "cleanup-a")
	if cleanup.Outcome != output.OutcomeFailed || cleanup.Error == nil || cleanup.Error.Kind != output.ErrorKindTeardown {
		t.Fatalf("teardown failure should carry the teardown marker, got %+v", cleanup)
	}
	// Remaining teardown steps still run after one fails.
	if b := stepByID(t, res, "cleanup-b"); b.Outcome != output.OutcomePassed {
		t.Fatalf("later teardown step should run, got %+v", b)
	}
}

func TestFailingTeardownAloneFailsTheRun(t *testing.T) {
	server, _ := newResourceServer(t, http.StatusCreated, "/items/item-42")
	// The only failing step is the teardown delete.
	var b strings.Builder
	b.WriteString(flowStep("create", "Create item", "POST /items", createCaptures))
	b.WriteString("```teardown\n@id cleanup-a\n@name Delete item\nDELETE /items/{{item_id}}\n\n[Asserts]\nstatus == 200\n```\n")
	res, _, err := runFlowResult(t, b.String(), server.URL)
	var exitErr *ExitError
	if !errors.As(err, &exitErr) || exitErr.Code != ExitRuntimeError {
		t.Fatalf("teardown-only failure should exit %d, got %v", ExitRuntimeError, err)
	}
	if res.OK || res.Summary.Failed != 1 {
		t.Fatalf("run should fail, got %+v", res.Summary)
	}
}

func TestSigintCancelsRequestAndRunsTeardown(t *testing.T) {
	if !signalTestsSupported() {
		t.Skip("signals not supported on this platform")
	}
	log := &hitLog{}
	entered := make(chan struct{}, 1)
	mux := http.NewServeMux()
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		log.add(r)
		w.Header().Set("Content-Type", "application/json")
		switch {
		case r.URL.Path == "/items" && r.Method == http.MethodPost:
			w.WriteHeader(http.StatusCreated)
			_, _ = w.Write([]byte(`{"id":"item-42"}`))
		case r.URL.Path == "/slow":
			entered <- struct{}{}
			select {
			case <-r.Context().Done():
			case <-time.After(10 * time.Second):
			}
		default:
			_, _ = w.Write([]byte(`{"ok":true}`))
		}
	})
	server := httptest.NewServer(mux)
	defer server.Close()

	var b strings.Builder
	b.WriteString(flowStep("create", "Create item", "POST /items", createCaptures))
	b.WriteString(flowStep("slow", "Slow step", "GET /slow", ""))
	b.WriteString(flowStep("never", "Never runs", "GET /health", ""))
	b.WriteString("```teardown\n@id cleanup\n@name Delete item\nDELETE /items/{{item_id}}\n```\n")

	go func() {
		<-entered
		sendSelfInterrupt(t)
	}()
	started := time.Now()
	res, _, err := runFlowResult(t, b.String(), server.URL)
	if time.Since(started) > 8*time.Second {
		t.Fatal("run did not stop promptly after the interrupt")
	}
	var exitErr *ExitError
	if !errors.As(err, &exitErr) || exitErr.Code != ExitInterrupted {
		t.Fatalf("expected exit code %d, got %v", ExitInterrupted, err)
	}
	if s := stepByID(t, res, "slow"); s.Outcome != output.OutcomeFailed || s.Error == nil || s.Error.Kind != output.ErrorKindInterrupted {
		t.Fatalf("in-flight step should be reported as interrupted, got %+v", s)
	}
	if log.count("DELETE /items/item-42") != 1 {
		t.Fatalf("teardown must run after an interrupt, hits=%v", log.hits)
	}
	if log.count("GET /health") != 0 {
		t.Fatalf("steps after the interrupt must not run, hits=%v", log.hits)
	}
	if res.ExitCode != ExitInterrupted {
		t.Fatalf("JSON exit_code = %d, want %d", res.ExitCode, ExitInterrupted)
	}
}

func TestTeardownRunsPerFileInDirectoryRunWithParallel(t *testing.T) {
	server, log := newResourceServer(t, http.StatusCreated, "")
	work := isolateKest(t)
	runParallel = true
	writeFlow(t, work, "a.flow.md", teardownFlow(true))
	writeFlow(t, work, "b.flow.md", teardownFlow(true))
	_, _ = runJSONExplicit(t, []string{"."}, server.URL)
	if got := log.count("DELETE /items/item-42"); got != 2 {
		t.Fatalf("each flow file must run its own teardown, got %d (hits=%v)", got, log.hits)
	}
}
