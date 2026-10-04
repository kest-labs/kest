package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"

	"github.com/kest-labs/kest/cli/internal/output"
)

// hitLog records the "METHOD /path" lines a stub server received.
type hitLog struct {
	mu   sync.Mutex
	hits []string
}

func (h *hitLog) add(r *http.Request) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.hits = append(h.hits, r.Method+" "+r.URL.Path)
}

func (h *hitLog) count(prefix string) int {
	h.mu.Lock()
	defer h.mu.Unlock()
	n := 0
	for _, hit := range h.hits {
		if strings.HasPrefix(hit, prefix) {
			n++
		}
	}
	return n
}

// newResourceServer serves a small CRUD API. createStatus controls what
// POST /items answers; failPath, when set, makes GET on that path return 500.
func newResourceServer(t *testing.T, createStatus int, failPath string) (*httptest.Server, *hitLog) {
	t.Helper()
	log := &hitLog{}
	mux := http.NewServeMux()
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		log.add(r)
		w.Header().Set("Content-Type", "application/json")
		switch {
		case r.URL.Path == "/health":
			_, _ = w.Write([]byte(`{"ok":true}`))
		case r.URL.Path == "/items" && r.Method == http.MethodPost:
			w.WriteHeader(createStatus)
			if createStatus < 300 {
				_, _ = w.Write([]byte(`{"id":"item-42"}`))
			} else {
				_, _ = w.Write([]byte(`{"error":"boom"}`))
			}
		case failPath != "" && r.URL.Path == failPath:
			w.WriteHeader(http.StatusInternalServerError)
			_, _ = w.Write([]byte(`{"error":"broken"}`))
		case strings.HasPrefix(r.URL.Path, "/items/"):
			_, _ = w.Write([]byte(`{"id":"item-42","name":"widget"}`))
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	})
	server := httptest.NewServer(mux)
	t.Cleanup(server.Close)
	return server, log
}

func flowStep(id, name, request string, extra string) string {
	return fmt.Sprintf("```step\n@id %s\n@name %s\n%s\n%s```\n\n", id, name, request, extra)
}

const createCaptures = "\n[Captures]\nitem_id = id\n\n[Asserts]\nstatus == 201\n"

// eightStepFlow is the scenario that used to produce a wall of failures:
// step 3 creates a resource, steps 4-6 use its id, step 7 is independent
// and step 8 deletes the resource in teardown.
func eightStepFlow() string {
	var b strings.Builder
	b.WriteString("# Items\n\n```flow\n@flow id=items\n@name Items\n@tags smoke, items\n```\n\n")
	b.WriteString(flowStep("health", "Health", "GET /health", "\n[Asserts]\nstatus == 200\n"))
	b.WriteString(flowStep("list", "List", "GET /items/index", "\n[Asserts]\nstatus == 200\n"))
	b.WriteString(flowStep("create", "Create item", "POST /items\nContent-Type: application/json\n\n{\"name\":\"widget\"}", createCaptures))
	b.WriteString(flowStep("read", "Read item", "GET /items/{{item_id}}", "\n[Asserts]\nstatus == 200\n"))
	b.WriteString(flowStep("update", "Update item", "GET /items/{{item_id}}/touch", "\n[Asserts]\nstatus == 200\n\n[Captures]\nitem_name = name\n"))
	b.WriteString(flowStep("rename", "Rename item", "GET /items/x?name={{item_name}}", "\n[Asserts]\nstatus == 200\n"))
	b.WriteString(flowStep("health2", "Health again", "GET /health", "\n[Asserts]\nstatus == 200\n"))
	b.WriteString("```teardown\n@id cleanup\n@name Delete item\nDELETE /items/{{item_id}}\n\n[Asserts]\nstatus == 200\n```\n")
	return b.String()
}

func runFlowResult(t *testing.T, content, baseURL string) (*output.Result, []byte, error) {
	t.Helper()
	work := isolateKest(t)
	writeFlow(t, work, "flow.flow.md", content)
	raw, err := runJSON(t, []string{"flow.flow.md"}, baseURL)
	var res output.Result
	if jerr := json.Unmarshal(raw, &res); jerr != nil {
		t.Fatalf("invalid JSON: %v\n%s", jerr, raw)
	}
	return &res, raw, err
}

func stepByID(t *testing.T, res *output.Result, id string) output.Step {
	t.Helper()
	for _, s := range res.Steps {
		if s.StepID == id {
			return s
		}
	}
	t.Fatalf("step %q not found in %+v", id, res.Steps)
	return output.Step{}
}

func TestFailedCaptureSkipsDependents(t *testing.T) {
	server, log := newResourceServer(t, http.StatusInternalServerError, "")
	res, raw, err := runFlowResult(t, eightStepFlow(), server.URL)

	var exitErr *ExitError
	if !errors.As(err, &exitErr) || exitErr.Code != ExitAssertionFailed {
		t.Fatalf("expected assertion exit code, got %v", err)
	}
	if res.Summary.Failed != 1 || res.Summary.Skipped != 4 || res.Summary.Passed != 3 || res.Summary.Total != 8 {
		t.Fatalf("unexpected summary %+v\n%s", res.Summary, raw)
	}
	if got := stepByID(t, res, "create"); got.Outcome != output.OutcomeFailed {
		t.Fatalf("create should have failed, got %+v", got)
	}
	for _, id := range []string{"read", "update", "rename"} {
		s := stepByID(t, res, id)
		if s.Outcome != output.OutcomeSkipped || s.SkippedBecause != "create" || s.OK {
			t.Fatalf("%s should be skipped because of create, got %+v", id, s)
		}
		if s.Error != nil {
			t.Fatalf("skipped step must not carry an error: %+v", s.Error)
		}
		if !strings.Contains(s.SkipReason, "Create item") {
			t.Fatalf("skip reason should name the root cause, got %q", s.SkipReason)
		}
	}
	if cleanup := stepByID(t, res, "cleanup"); cleanup.Outcome != output.OutcomeSkipped || cleanup.Phase != phaseTeardown {
		t.Fatalf("teardown should be skipped, got %+v", cleanup)
	}
	if h := stepByID(t, res, "health2"); h.Outcome != output.OutcomePassed {
		t.Fatalf("independent step must still run, got %+v", h)
	}
	// The dependent steps must never reach the server.
	if n := log.count("GET /items/item") + log.count("GET /items/x") + log.count("DELETE"); n != 0 {
		t.Fatalf("skipped steps hit the server %d time(s): %v", n, log.hits)
	}
}

func TestSkippedStepsDoNotChangeExitCode(t *testing.T) {
	// The exit code is derived from the failing step (assertion = 1) and is
	// the same with or without the skipped dependents.
	server, _ := newResourceServer(t, http.StatusInternalServerError, "")
	res, _, err := runFlowResult(t, eightStepFlow(), server.URL)
	if err == nil || res.ExitCode != ExitAssertionFailed || res.OK {
		t.Fatalf("unexpected result ok=%v exit=%d err=%v", res.OK, res.ExitCode, err)
	}
	if failure := res.FirstFailure(); failure == nil || failure.Kind != output.ErrorKindAssertion {
		t.Fatalf("run error should come from the failed step, got %+v", failure)
	}
}

func TestPassingRunHasNoSkips(t *testing.T) {
	server, _ := newResourceServer(t, http.StatusCreated, "")
	res, _, err := runFlowResult(t, eightStepFlow(), server.URL)
	if err != nil {
		t.Fatalf("unexpected failure: %v", err)
	}
	if res.Summary.Skipped != 0 || res.Summary.Failed != 0 || res.Summary.Passed != 8 {
		t.Fatalf("unexpected summary %+v", res.Summary)
	}
}

func TestSkipPropagatesThroughChain(t *testing.T) {
	// update captures item_name but is skipped, so rename (which needs
	// item_name) is skipped because of update's root cause, not failed.
	server, _ := newResourceServer(t, http.StatusInternalServerError, "")
	res, _, _ := runFlowResult(t, eightStepFlow(), server.URL)
	rename := stepByID(t, res, "rename")
	if rename.Outcome != output.OutcomeSkipped || rename.SkippedBecause != "create" {
		t.Fatalf("rename should be skipped with root cause create, got %+v", rename)
	}
}

func TestMidFlowFailureSkipsOnlyDependents(t *testing.T) {
	// Create succeeds but "update" (step 5) fails; rename is skipped and the
	// teardown delete still has its item_id.
	server, log := newResourceServer(t, http.StatusCreated, "/items/item-42/touch")
	res, _, _ := runFlowResult(t, eightStepFlow(), server.URL)
	if res.Summary.Failed != 1 || res.Summary.Skipped != 1 {
		t.Fatalf("unexpected summary %+v", res.Summary)
	}
	if s := stepByID(t, res, "update"); s.Outcome != output.OutcomeFailed {
		t.Fatalf("update should fail, got %+v", s)
	}
	if s := stepByID(t, res, "rename"); s.Outcome != output.OutcomeSkipped || s.SkippedBecause != "update" {
		t.Fatalf("rename should be skipped because of update, got %+v", s)
	}
	if s := stepByID(t, res, "read"); s.Outcome != output.OutcomePassed {
		t.Fatalf("read should pass, got %+v", s)
	}
	if log.count("DELETE /items/item-42") != 1 {
		t.Fatalf("teardown delete should run once, hits=%v", log.hits)
	}
}

func TestOnSuccessEdgeSkipsTarget(t *testing.T) {
	server, log := newResourceServer(t, http.StatusInternalServerError, "")
	var b strings.Builder
	b.WriteString("```flow\n@flow id=edges\n```\n\n")
	b.WriteString(flowStep("create", "Create", "POST /items", "\n[Asserts]\nstatus == 201\n"))
	b.WriteString(flowStep("after", "After create", "GET /health", "\n[Asserts]\nstatus == 200\n"))
	b.WriteString(flowStep("other", "Other", "GET /health", "\n[Asserts]\nstatus == 200\n"))
	b.WriteString("```edge\n@from create\n@to after\n@on success\n```\n")
	res, _, _ := runFlowResult(t, b.String(), server.URL)
	if s := stepByID(t, res, "after"); s.Outcome != output.OutcomeSkipped || s.SkippedBecause != "create" {
		t.Fatalf("edge target should be skipped, got %+v", s)
	}
	if s := stepByID(t, res, "other"); s.Outcome != output.OutcomePassed {
		t.Fatalf("unrelated step should pass, got %+v", s)
	}
	if log.count("GET /health") != 1 {
		t.Fatalf("expected exactly one health call, hits=%v", log.hits)
	}
}

func TestExplicitVarSurvivesFailedCapture(t *testing.T) {
	// A --var value is not invalidated by a failing capture step.
	server, _ := newResourceServer(t, http.StatusInternalServerError, "")
	work := isolateKest(t)
	writeFlow(t, work, "flow.flow.md", eightStepFlow())
	runVars = []string{"item_id=item-99"}
	raw, _ := runJSON(t, []string{"flow.flow.md"}, server.URL)
	var res output.Result
	if err := json.Unmarshal(raw, &res); err != nil {
		t.Fatal(err)
	}
	if s := stepByID(t, &res, "read"); s.Outcome != output.OutcomePassed {
		t.Fatalf("read should use --var item_id, got %+v", s)
	}
}

func TestJUnitReportsSkipped(t *testing.T) {
	server, _ := newResourceServer(t, http.StatusInternalServerError, "")
	res, _, _ := runFlowResult(t, eightStepFlow(), server.URL)
	var buf bytes.Buffer
	if err := output.WriteJUnit(&buf, res); err != nil {
		t.Fatal(err)
	}
	xml := buf.String()
	if strings.Count(xml, "<skipped") < 4 {
		t.Fatalf("expected <skipped> test cases, got:\n%s", xml)
	}
	if !strings.Contains(xml, `skipped="4"`) || !strings.Contains(xml, `failures="1"`) {
		t.Fatalf("unexpected suite counters:\n%s", xml)
	}
}

func TestFlowJSONReportCountsSkips(t *testing.T) {
	server, _ := newResourceServer(t, http.StatusInternalServerError, "")
	work := isolateKest(t)
	writeFlow(t, work, "flow.flow.md", eightStepFlow())
	runReportJSON = filepath.Join(work, "report.json")
	_, _ = runJSON(t, []string{"flow.flow.md"}, server.URL)
	var rep flowJSONReport
	data := mustReadFile(t, runReportJSON)
	if err := json.Unmarshal(data, &rep); err != nil {
		t.Fatal(err)
	}
	if rep.FailedSteps != 1 || rep.SkippedSteps != 4 {
		t.Fatalf("unexpected report counters %+v", rep)
	}
}

func TestConsoleSummaryNamesRootCause(t *testing.T) {
	server, _ := newResourceServer(t, http.StatusInternalServerError, "")
	work := isolateKest(t)
	writeFlow(t, work, "flow.flow.md", eightStepFlow())
	output.JSONOutput = false
	out := captureStdout(t, func() {
		runBaseURL = server.URL
		_, _ = runSuite([]string{"flow.flow.md"}, func(name string) bool { return name == "base-url" })
	})
	for _, want := range []string{"1 failed", "4 skipped", "caused by Create item (4)", "Root cause:", "Create item - assertion failed", "skipped: depends on Create item which failed"} {
		if !strings.Contains(out, want) {
			t.Fatalf("console output missing %q:\n%s", want, out)
		}
	}
}

func mustReadFile(t *testing.T, path string) []byte {
	t.Helper()
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read %s: %v", path, err)
	}
	return data
}
