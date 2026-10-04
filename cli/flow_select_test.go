package main

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"testing"

	"github.com/kest-labs/kest/cli/internal/output"
)

func withSelection(sel runSelection) func() {
	return func() { runSel = sel }
}

func executedIDs(res *output.Result) []string {
	var ids []string
	for _, s := range res.Steps {
		if s.Outcome != output.OutcomeSkipped {
			ids = append(ids, s.StepID)
		}
	}
	return ids
}

func TestOnlyRunsCapturingDependenciesAndTeardown(t *testing.T) {
	server, log := newResourceServer(t, http.StatusCreated, "")
	res, _, err := runFlowResultWith(t, eightStepFlow(), server.URL, withSelection(runSelection{only: []string{"read"}}))
	if err != nil {
		t.Fatalf("unexpected failure: %v", err)
	}
	got := strings.Join(executedIDs(res), ",")
	if got != "create,read,cleanup" {
		t.Fatalf("executed %q, want create,read,cleanup (hits=%v)", got, log.hits)
	}
	if log.count("DELETE /items/item-42") != 1 {
		t.Fatalf("teardown should run for the dependency, hits=%v", log.hits)
	}
}

func TestOnlyFollowsDependencyChain(t *testing.T) {
	// rename needs item_name (captured by update) which needs item_id.
	server, _ := newResourceServer(t, http.StatusCreated, "")
	res, _, err := runFlowResultWith(t, eightStepFlow(), server.URL, withSelection(runSelection{only: []string{"rename"}}))
	if err != nil {
		t.Fatalf("unexpected failure: %v", err)
	}
	if got := strings.Join(executedIDs(res), ","); got != "create,update,rename,cleanup" {
		t.Fatalf("executed %q", got)
	}
}

func TestFromRunsTheTailWithDependencies(t *testing.T) {
	server, _ := newResourceServer(t, http.StatusCreated, "")
	res, _, err := runFlowResultWith(t, eightStepFlow(), server.URL, withSelection(runSelection{from: "update"}))
	if err != nil {
		t.Fatalf("unexpected failure: %v", err)
	}
	if got := strings.Join(executedIDs(res), ","); got != "create,update,rename,health2,cleanup" {
		t.Fatalf("executed %q", got)
	}
}

func TestNoDepsRunsExactlyTheSelectedSteps(t *testing.T) {
	server, log := newResourceServer(t, http.StatusCreated, "")
	res, _, err := runFlowResultWith(t, eightStepFlow(), server.URL, func() {
		runSel = runSelection{only: []string{"read"}, noDeps: true}
		runVars = []string{"item_id=zzz"}
	})
	if err != nil {
		t.Fatalf("unexpected failure: %v", err)
	}
	if got := strings.Join(executedIDs(res), ","); got != "read" {
		t.Fatalf("executed %q", got)
	}
	if len(log.hits) != 1 || log.hits[0] != "GET /items/zzz" {
		t.Fatalf("unexpected requests %v", log.hits)
	}
}

func TestNoDepsErrorsOnMissingVariable(t *testing.T) {
	server, log := newResourceServer(t, http.StatusCreated, "")
	_, _, err := runFlowResultWith(t, eightStepFlow(), server.URL, withSelection(runSelection{only: []string{"read"}, noDeps: true}))
	var exitErr *ExitError
	if !errors.As(err, &exitErr) || exitErr.Code != ExitConfigError {
		t.Fatalf("expected config error, got %v", err)
	}
	for _, want := range []string{"item_id", "create", "--no-deps"} {
		if !strings.Contains(err.Error(), want) {
			t.Fatalf("error %q should mention %q", err, want)
		}
	}
	if len(log.hits) != 0 {
		t.Fatalf("nothing should run on a selection error: %v", log.hits)
	}
}

func TestSkipMarksStepSkippedAndKeepsRunPassing(t *testing.T) {
	server, log := newResourceServer(t, http.StatusCreated, "")
	res, _, err := runFlowResultWith(t, eightStepFlow(), server.URL, withSelection(runSelection{skip: []string{"health2", "create"}}))
	if err != nil {
		t.Fatalf("--skip alone must not fail the run: %v", err)
	}
	if s := stepByID(t, res, "health2"); s.Outcome != output.OutcomeSkipped || s.SkipReason != "skipped by --skip" {
		t.Fatalf("health2 should be skipped by --skip, got %+v", s)
	}
	// Steps needing the skipped create are skipped, not failed.
	if s := stepByID(t, res, "read"); s.Outcome != output.OutcomeSkipped || s.SkippedBecause != "create" {
		t.Fatalf("read should be skipped because create was, got %+v", s)
	}
	if log.count("POST /items") != 0 || log.count("DELETE") != 0 {
		t.Fatalf("skipped steps ran: %v", log.hits)
	}
}

func TestUnknownStepIDListsCloseMatches(t *testing.T) {
	server, log := newResourceServer(t, http.StatusCreated, "")
	_, _, err := runFlowResultWith(t, eightStepFlow(), server.URL, withSelection(runSelection{only: []string{"creat"}}))
	var exitErr *ExitError
	if !errors.As(err, &exitErr) || exitErr.Code != ExitConfigError {
		t.Fatalf("expected config error, got %v", err)
	}
	if !strings.Contains(err.Error(), `unknown step id "creat"`) || !strings.Contains(err.Error(), "did you mean: create") {
		t.Fatalf("error should suggest create, got %q", err)
	}
	if len(log.hits) != 0 {
		t.Fatalf("nothing should run: %v", log.hits)
	}
}

func TestStepSelectionNeedsSingleFile(t *testing.T) {
	server, _ := newResourceServer(t, http.StatusCreated, "")
	work := isolateKest(t)
	runSel = runSelection{only: []string{"read"}}
	writeFlow(t, work, "a.flow.md", eightStepFlow())
	writeFlow(t, work, "b.flow.md", eightStepFlow())
	_, err := runJSONExplicit(t, []string{"."}, server.URL)
	var exitErr *ExitError
	if !errors.As(err, &exitErr) || exitErr.Code != ExitConfigError || !strings.Contains(err.Error(), "single flow file") {
		t.Fatalf("expected single-file usage error, got %v", err)
	}
}

func taggedFlow(id, tags string) string {
	return "```flow\n@flow id=" + id + "\n@tags " + tags + "\n```\n\n" +
		flowStep("health", "Health "+id, "GET /health?flow="+id, "\n[Asserts]\nstatus == 200\n")
}

func TestTagSelectsFlowFiles(t *testing.T) {
	server, log := newResourceServer(t, http.StatusCreated, "")
	work := isolateKest(t)
	runSel = runSelection{tags: []string{"Smoke"}}
	writeFlow(t, work, "a.flow.md", taggedFlow("alpha", "smoke, auth"))
	writeFlow(t, work, "b.flow.md", taggedFlow("beta", "slow"))
	writeFlow(t, work, "c.flow.md", taggedFlow("gamma", "smoke"))
	raw, err := runJSONExplicit(t, []string{"."}, server.URL)
	if err != nil {
		t.Fatalf("unexpected failure: %v", err)
	}
	var res output.Result
	if err := json.Unmarshal(raw, &res); err != nil {
		t.Fatal(err)
	}
	if res.Summary.Total != 2 || log.count("GET /health") != 2 {
		t.Fatalf("expected two smoke flows to run, summary=%+v hits=%v", res.Summary, log.hits)
	}
}

func TestTagWithNoMatchIsUsageError(t *testing.T) {
	server, log := newResourceServer(t, http.StatusCreated, "")
	work := isolateKest(t)
	runSel = runSelection{tags: []string{"nightly"}}
	writeFlow(t, work, "a.flow.md", taggedFlow("alpha", "smoke, auth"))
	_, err := runJSONExplicit(t, []string{"a.flow.md"}, server.URL)
	var exitErr *ExitError
	if !errors.As(err, &exitErr) || exitErr.Code != ExitConfigError {
		t.Fatalf("expected config error, got %v", err)
	}
	if !strings.Contains(err.Error(), "smoke") || !strings.Contains(err.Error(), "auth") {
		t.Fatalf("error should list the tags in use, got %q", err)
	}
	if len(log.hits) != 0 {
		t.Fatalf("nothing should run: %v", log.hits)
	}
}

func TestTagOnSingleMatchingFileIsNoOp(t *testing.T) {
	server, _ := newResourceServer(t, http.StatusCreated, "")
	work := isolateKest(t)
	runSel = runSelection{tags: []string{"auth"}}
	writeFlow(t, work, "a.flow.md", taggedFlow("alpha", "smoke, auth"))
	if _, err := runJSONExplicit(t, []string{"a.flow.md"}, server.URL); err != nil {
		t.Fatalf("matching single file should run: %v", err)
	}
}

func TestListDoesNotExecuteAndHonorsSelection(t *testing.T) {
	server, log := newResourceServer(t, http.StatusCreated, "")
	work := isolateKest(t)
	runSel = runSelection{list: true, only: []string{"read"}, skip: []string{"cleanup-none"}}
	writeFlow(t, work, "flow.flow.md", eightStepFlow())

	// An unknown --skip id is still a usage error in list mode.
	if _, err := runJSONExplicit(t, []string{"flow.flow.md"}, server.URL); err == nil {
		t.Fatal("expected unknown --skip id to fail")
	}

	runSel = runSelection{list: true, only: []string{"read"}}
	raw, err := runJSONExplicit(t, []string{"flow.flow.md"}, server.URL)
	if err != nil {
		t.Fatalf("list failed: %v", err)
	}
	if len(log.hits) != 0 {
		t.Fatalf("--list must not send requests: %v", log.hits)
	}
	var doc struct {
		OK   bool `json:"ok"`
		Data struct {
			List  bool `json:"list"`
			Flows []struct {
				FlowID string   `json:"flow_id"`
				Tags   []string `json:"tags"`
				Steps  []struct {
					ID        string   `json:"id"`
					Phase     string   `json:"phase"`
					Line      int      `json:"line"`
					Selection string   `json:"selection"`
					Captures  []string `json:"captures"`
				} `json:"steps"`
			} `json:"flows"`
		} `json:"data"`
	}
	if err := json.Unmarshal(raw, &doc); err != nil {
		t.Fatalf("invalid JSON: %v\n%s", err, raw)
	}
	if !doc.OK || !doc.Data.List || len(doc.Data.Flows) != 1 {
		t.Fatalf("unexpected list document: %s", raw)
	}
	flow := doc.Data.Flows[0]
	if flow.FlowID != "items" || strings.Join(flow.Tags, ",") != "smoke,items" {
		t.Fatalf("flow metadata wrong: %+v", flow)
	}
	var ids []string
	for _, s := range flow.Steps {
		ids = append(ids, s.Phase+":"+s.ID+":"+s.Selection)
		if s.Line == 0 {
			t.Fatalf("step %s has no line number", s.ID)
		}
	}
	want := "step:create:dependency,step:read:run,teardown:cleanup:run"
	if strings.Join(ids, ",") != want {
		t.Fatalf("listed %q, want %q", strings.Join(ids, ","), want)
	}
}

func TestListHumanOutput(t *testing.T) {
	server, _ := newResourceServer(t, http.StatusCreated, "")
	work := isolateKest(t)
	output.JSONOutput = false
	runSel = runSelection{list: true}
	writeFlow(t, work, "flow.flow.md", eightStepFlow())
	out := captureStdout(t, func() {
		runBaseURL = server.URL
		if _, err := runSuite([]string{"flow.flow.md"}, func(name string) bool { return name == "base-url" }); err != nil {
			t.Fatal(err)
		}
	})
	for _, want := range []string{"tags: smoke, items", "create", "POST /items", "captures: item_id", "teardown", "cleanup"} {
		if !strings.Contains(out, want) {
			t.Fatalf("list output missing %q:\n%s", want, out)
		}
	}
}

func TestListEmptyFlowHasEmptyStepsArray(t *testing.T) {
	server, _ := newResourceServer(t, http.StatusCreated, "")
	work := isolateKest(t)
	runSel = runSelection{list: true}
	writeFlow(t, work, "meta.flow.md", "```flow\n@flow id=empty\n@tags a\n```\n")
	raw, err := runJSONExplicit(t, []string{"meta.flow.md"}, server.URL)
	if err != nil {
		t.Fatalf("list failed: %v", err)
	}
	if !strings.Contains(string(raw), `"steps": []`) || strings.Contains(string(raw), `"steps": null`) {
		t.Fatalf("steps should be an empty array:\n%s", raw)
	}
}
