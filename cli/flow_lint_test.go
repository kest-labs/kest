package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
)

func lintOne(t *testing.T, content string, rules ...string) []LintFinding {
	t.Helper()
	dir := t.TempDir()
	p := filepath.Join(dir, "x.flow.md")
	if err := os.WriteFile(p, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
	rep, err := runLint(lintOptions{Paths: []string{p}, Rules: rules})
	if err != nil {
		t.Fatal(err)
	}
	return rep.Findings
}

func rulesOf(fs []LintFinding) []string {
	var out []string
	for _, f := range fs {
		out = append(out, f.Rule)
	}
	return out
}

func stepBlock(id, req string, asserts ...string) string {
	b := "```step\n@id " + id + "\n" + req + "\n"
	if len(asserts) > 0 {
		b += "\n[Asserts]\n" + strings.Join(asserts, "\n") + "\n"
	}
	return b + "```\n\n"
}

func edgeBlock(from, to, on string) string {
	s := "```edge\n@from " + from + "\n@to " + to + "\n"
	if on != "" {
		s += "@on " + on + "\n"
	}
	return s + "```\n\n"
}

// fixFile writes content, runs `lint --fix` restricted to rules and returns
// the report and the rewritten content.
func fixFile(t *testing.T, content string, rules ...string) (*LintReport, string, string) {
	t.Helper()
	dir := t.TempDir()
	p := filepath.Join(dir, "x.flow.md")
	if err := os.WriteFile(p, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
	rep, err := runLint(lintOptions{Paths: []string{p}, Fix: true, Rules: rules})
	if err != nil {
		t.Fatal(err)
	}
	out, err := os.ReadFile(p)
	if err != nil {
		t.Fatal(err)
	}
	return rep, string(out), p
}

// ---- redundant-edge ----------------------------------------------------------

func TestRedundantEdgeFixIsEquivalentAndIdempotent(t *testing.T) {
	src := "# Flow\n\n```flow\n@flow id=e\n```\n\n" +
		stepBlock("a", "GET /a", "status == 200") +
		edgeBlock("a", "b", "success") +
		stepBlock("b", "GET /b", "status == 200") +
		edgeBlock("b", "c", "") +
		stepBlock("c", "GET /c", "status == 200") +
		"Some prose after.\n"

	rep, fixed, p := fixFile(t, src, "redundant-edge")
	if len(rep.Fixes) != 1 || rep.Fixes[0].Applied != 2 {
		t.Fatalf("fixes = %+v", rep.Fixes)
	}
	if strings.Contains(fixed, "```edge") {
		t.Fatalf("edges not removed:\n%s", fixed)
	}
	before, _ := ParseFlowDocument(src)
	after, _ := ParseFlowDocument(fixed)
	if !flowPlansEquivalent(BuildFlowPlan(before), BuildFlowPlan(after)) || len(after.Edges) != 0 {
		t.Fatal("plan changed")
	}
	if strings.Contains(fixed, "\n\n\n") {
		t.Fatalf("fix left a double blank line:\n%q", fixed)
	}
	// Second run: nothing to do, file untouched.
	rep2, err := runLint(lintOptions{Paths: []string{p}, Fix: true, Rules: []string{"redundant-edge"}})
	if err != nil {
		t.Fatal(err)
	}
	again, _ := os.ReadFile(p)
	if len(rep2.Fixes) != 0 || string(again) != fixed || len(rep2.Findings) != 0 {
		t.Fatalf("not idempotent: %+v", rep2)
	}
}

func TestRedundantEdgeKeepsNonLinearAndOrderChangingEdges(t *testing.T) {
	// d must run before b (edge d->b). Removing the linear edge b->c would
	// change the order, so it must be kept; a->b is safe to remove.
	src := "```flow\n@flow id=e\n```\n\n" +
		stepBlock("a", "GET /a", "status == 200") + stepBlock("b", "GET /b", "status == 200") +
		stepBlock("c", "GET /c", "status == 200") + stepBlock("d", "GET /d", "status == 200") +
		edgeBlock("a", "b", "success") + edgeBlock("b", "c", "success") + edgeBlock("d", "b", "success")

	findings := lintOne(t, src, "redundant-edge")
	if len(findings) != 2 {
		t.Fatalf("expected 2 linear edges reported, got %+v", findings)
	}
	rep, fixed, _ := fixFile(t, src, "redundant-edge")
	before, _ := ParseFlowDocument(src)
	after, _ := ParseFlowDocument(fixed)
	if !flowPlansEquivalent(BuildFlowPlan(before), BuildFlowPlan(after)) {
		t.Fatalf("plan changed:\n%s", fixed)
	}
	if len(after.Edges) == 0 {
		t.Fatalf("order-relevant edges were removed:\n%s", fixed)
	}
	if len(rep.Skipped) == 0 {
		t.Fatalf("expected a skipped-fix explanation, got %+v", rep)
	}
}

func TestRedundantEdgeIgnoresFailureAndNonAdjacentEdges(t *testing.T) {
	src := "```flow\n@flow id=e\n```\n\n" +
		stepBlock("a", "GET /a", "status == 200") + stepBlock("b", "GET /b", "status == 200") + stepBlock("c", "GET /c", "status == 200") +
		edgeBlock("a", "b", "failure") + edgeBlock("a", "c", "success")
	if got := lintOne(t, src, "redundant-edge"); len(got) != 0 {
		t.Fatalf("unexpected findings %+v", got)
	}
}

// ---- trailing-delete-cleanup -------------------------------------------------

const trailingDeleteFlow = "# Items\n\n```flow\n@flow id=td\n```\n\n" +
	"```step\n@id create\nPOST /items\nContent-Type: application/json\n\n{\"n\":1}\n\n[Captures]\nitem = id\n\n[Asserts]\nstatus == 200\n```\n\n" +
	"```step\n@id read\nGET /items/{{item}}\n\n[Asserts]\nstatus == 200\n```\n\n" +
	"```step\nDELETE /items/{{item}}\n\n[Asserts]\nstatus == 204\n```\n\n" +
	"```step\n@id drop-parent\nDELETE /parents/{{item}}\n```\n"

func TestTrailingDeleteMovedToTeardown(t *testing.T) {
	findings := lintOne(t, trailingDeleteFlow, "trailing-delete-cleanup")
	if len(findings) != 1 || !findings[0].Fixable || !strings.Contains(findings[0].Message, "step-3, drop-parent") {
		t.Fatalf("findings = %+v", findings)
	}
	rep, fixed, p := fixFile(t, trailingDeleteFlow, "trailing-delete-cleanup")
	if len(rep.Fixes) != 1 || rep.Fixes[0].Applied != 2 {
		t.Fatalf("fixes = %+v skipped=%+v", rep.Fixes, rep.Skipped)
	}
	doc, _ := ParseFlowDocument(fixed)
	if len(doc.Steps) != 2 || len(doc.Teardown) != 2 {
		t.Fatalf("steps=%d teardown=%d\n%s", len(doc.Steps), len(doc.Teardown), fixed)
	}
	if doc.Teardown[0].ID != "step-3" || doc.Teardown[1].ID != "drop-parent" {
		t.Fatalf("teardown ids = %q, %q (implicit id must be preserved)", doc.Teardown[0].ID, doc.Teardown[1].ID)
	}
	orig, _ := ParseFlowDocument(trailingDeleteFlow)
	if !flowPlansEquivalent(BuildFlowPlan(orig), BuildFlowPlan(doc)) {
		t.Fatal("execution sequence changed")
	}
	rep2, _ := runLint(lintOptions{Paths: []string{p}, Fix: true, Rules: []string{"trailing-delete-cleanup"}})
	again, _ := os.ReadFile(p)
	if len(rep2.Fixes) != 0 || string(again) != fixed || len(rep2.Findings) != 0 {
		t.Fatalf("not idempotent: %+v", rep2)
	}
}

func TestTrailingDeleteRunsEquivalently(t *testing.T) {
	work := isolateKest(t)
	srvA, srvB := newRecordingServer(t), newRecordingServer(t)
	if _, err := runFlowFile(t, work, "orig.flow.md", trailingDeleteFlow, srvA.URL); err != nil {
		t.Fatalf("original: %v", err)
	}
	_, fixed, _ := fixFile(t, trailingDeleteFlow, "trailing-delete-cleanup")
	if _, err := runFlowFile(t, work, "fixed.flow.md", fixed, srvB.URL); err != nil {
		t.Fatalf("fixed: %v", err)
	}
	if !reflect.DeepEqual(srvA.paths(), srvB.paths()) || len(srvA.paths()) != 4 {
		t.Fatalf("request sequences differ:\n%v\n%v", srvA.paths(), srvB.paths())
	}
}

func TestTrailingDeleteNotReportedWhenNotClearlyCleanup(t *testing.T) {
	cases := map[string]string{
		"literal url": "```step\n@id a\nGET /a\n\n[Captures]\nx = id\n```\n\n```step\n@id d\nDELETE /things/5\n```\n",
		"uncaptured":  "```step\n@id a\nGET /a\n```\n\n```step\n@id d\nDELETE /things/{{never}}\n```\n",
		"captures":    "```step\n@id a\nGET /a\n\n[Captures]\nx = id\n```\n\n```step\n@id d\nDELETE /things/{{x}}\n\n[Captures]\ny = z\n```\n",
		"only step":   "```step\n@id d\nDELETE /things/{{x}}\n```\n",
	}
	for name, src := range cases {
		if got := lintOne(t, src, "trailing-delete-cleanup"); len(got) != 0 {
			t.Errorf("%s: unexpected findings %+v", name, got)
		}
	}
}

func TestTrailingDeleteWithEdgeOrExistingTeardownIsNotAutoFixed(t *testing.T) {
	withEdge := "```flow\n@flow id=x\n```\n\n" +
		"```step\n@id a\nGET /a\n\n[Captures]\nx = id\n```\n\n```step\n@id d\nDELETE /t/{{x}}\n```\n\n" + edgeBlock("a", "d", "success")
	got := lintOne(t, withEdge, "trailing-delete-cleanup")
	if len(got) != 1 || got[0].Fixable {
		t.Fatalf("edge-referenced cleanup must be reported but not fixable: %+v", got)
	}
	earlyTeardown := "```teardown\n@id early\nGET /bye\n```\n\n" +
		"```step\n@id a\nGET /a\n\n[Captures]\nx = id\n```\n\n```step\n@id d\nDELETE /t/{{x}}\n```\n"
	got = lintOne(t, earlyTeardown, "trailing-delete-cleanup")
	if len(got) != 1 || got[0].Fixable {
		t.Fatalf("expected unfixable finding: %+v", got)
	}
	_, fixed, _ := fixFile(t, earlyTeardown, "trailing-delete-cleanup")
	if fixed != earlyTeardown {
		t.Fatal("file must be left untouched")
	}
}

// ---- inline-secret -----------------------------------------------------------

func TestInlineSecretFindsLiteralsWithoutLeakingThem(t *testing.T) {
	src := "```step\n@id login\nPOST /login\nAuthorization: Bearer abcdefghijklmnopqrstuvwxyz0123456789\nX-Api-Key: sk_live_SUPERSECRETVALUE\nContent-Type: application/json\n\n" +
		"{\"username\": \"admin\", \"password\": \"hunter2-hunter2\", \"token\": \"{{tok}}\", \"new_password\": \"{{$env.NEWPW}}\", \"note\": \"password\"}\n\n" +
		"[Asserts]\nbody.password == \"hunter2-hunter2\"\n```\n\n" +
		"```step\n@id short\nGET /x\nAuthorization: Bearer short\n```\n"
	dir := t.TempDir()
	p := filepath.Join(dir, "s.flow.md")
	if err := os.WriteFile(p, []byte(src), 0o644); err != nil {
		t.Fatal(err)
	}
	rep, err := runLint(lintOptions{Paths: []string{p}, Rules: []string{"inline-secret"}})
	if err != nil {
		t.Fatal(err)
	}
	if len(rep.Findings) != 3 { // bearer line, api key line, password line
		t.Fatalf("findings = %+v", rep.Findings)
	}
	for _, f := range rep.Findings {
		if f.Severity != lintWarning || f.Fixable {
			t.Errorf("secrets are report-only warnings: %+v", f)
		}
	}
	blob, _ := json.Marshal(rep)
	for _, secret := range []string{"hunter2", "abcdefghijklmnopqrstuvwxyz", "SUPERSECRETVALUE"} {
		if strings.Contains(string(blob), secret) {
			t.Fatalf("report leaks secret %q: %s", secret, blob)
		}
	}
	if !strings.Contains(string(blob), "{{$env.PASSWORD}}") {
		t.Fatalf("expected an env suggestion: %s", blob)
	}
	if rep.OK != true { // warnings do not fail by default
		t.Fatal("warnings must not fail the run by default")
	}
}

// ---- legacy-format -----------------------------------------------------------

const legacyFlow = "# Legacy\n\nSome docs.\n\n" +
	"```kest\nPOST /login\nContent-Type: application/json\n\n{\"user\": \"u\"}\n\n[Captures]\ntok = token # the token\n\n[Asserts]\nstatus == 200 # ok\nbody.ok == true\n```\n\n" +
	"```kest\nGET /me?x=1\nAuthorization: Bearer {{tok}}\n\n[Asserts]\nstatus == 200\n```\n\n" +
	"```kest\nGET /missing\n\n[Asserts]\nstatus == 404\n```\n"

func TestLegacyFormatConvertsAndRunsIdentically(t *testing.T) {
	work := isolateKest(t)
	srvA, srvB := newRecordingServer(t), newRecordingServer(t)

	resA, errA := runFlowFile(t, work, "legacy.flow.md", legacyFlow, srvA.URL)

	rep, fixed, _ := fixFile(t, legacyFlow, "legacy-format")
	if len(rep.Fixes) != 1 || rep.Fixes[0].Applied != 3 || strings.Contains(fixed, "```kest") {
		t.Fatalf("fixes=%+v skipped=%+v\n%s", rep.Fixes, rep.Skipped, fixed)
	}
	if !strings.Contains(fixed, "Some docs.") {
		t.Fatal("prose must be preserved")
	}
	resB, errB := runFlowFile(t, work, "converted.flow.md", fixed, srvB.URL)

	if (errA == nil) != (errB == nil) {
		t.Fatalf("outcome differs: %v vs %v", errA, errB)
	}
	if !reflect.DeepEqual(srvA.paths(), srvB.paths()) || len(srvA.paths()) != 3 {
		t.Fatalf("request sequences differ:\n%v\n%v", srvA.paths(), srvB.paths())
	}
	for i := range srvA.requests() {
		a, b := srvA.requests()[i], srvB.requests()[i]
		// The legacy parser keeps a trailing newline after a JSON body; the step
		// format drops it (documented, only allowed for JSON bodies).
		if strings.TrimSpace(a.Body) != strings.TrimSpace(b.Body) || a.Authrzn != b.Authrzn || a.Header.Get("Content-Type") != b.Header.Get("Content-Type") {
			t.Fatalf("request %d differs: %+v vs %+v", i, a, b)
		}
	}
	if len(resA.Steps) != len(resB.Steps) {
		t.Fatalf("step counts differ: %d vs %d", len(resA.Steps), len(resB.Steps))
	}
	for i := range resA.Steps {
		a, b := resA.Steps[i], resB.Steps[i]
		if a.OK != b.OK || a.Status != b.Status || a.Method != b.Method || len(a.Assertions) != len(b.Assertions) {
			t.Errorf("step %d differs: %+v vs %+v", i, a, b)
		}
	}
}

func TestLegacyFormatNotConvertedWhenUnfaithful(t *testing.T) {
	mixed := "```kest\nGET /a\n```\n\n```step\n@id s\nGET /b\n```\n"
	withJSON := "```kest\nGET /a\n```\n\n```json\n{\"a\": 1}\n```\n"
	badBlock := "```kest\nnonsense\n```\n"
	textBody := "```kest\nPOST /a\nContent-Type: text/plain\n\nhello\n\n[Asserts]\nstatus == 200\n```\n"
	withID := "```flow\n@flow id=x\n```\n\n```kest\nGET /a\n```\n"
	for name, src := range map[string]string{"mixed": mixed, "json": withJSON, "bad": badBlock, "id": withID, "text": textBody, "comment": "```kest\n# explain\nGET /a\n```\n"} {
		got := lintOne(t, src, "legacy-format")
		if len(got) != 1 || got[0].Fixable || !strings.Contains(got[0].Message, "cannot be converted automatically") {
			t.Errorf("%s: findings = %+v", name, got)
		}
		rep, fixed, _ := fixFile(t, src, "legacy-format")
		if fixed != src || len(rep.Fixes) != 0 || len(rep.Skipped) != 1 {
			t.Errorf("%s: file must be untouched and the reason reported: fixed=%v skipped=%+v", name, fixed != src, rep.Skipped)
		}
	}
}

// ---- duplicate-step-block ----------------------------------------------------

func TestDuplicateStepBlockNeedsThreeFiles(t *testing.T) {
	dir := t.TempDir()
	login := "```step\n@id login\nPOST /v1/login\nContent-Type: application/json\n\n{\"user\":\"a\",\"pw\":\"b\"}\n\n[Captures]\ntoken = token\n```\n"
	for i, n := range []string{"a", "b", "c"} {
		body := login
		if i == 1 {
			body = strings.Replace(login, "@id login", "@id sign-in\n@name Different id and name", 1) // still identical request
		}
		if err := os.WriteFile(filepath.Join(dir, n+".flow.md"), []byte(body+"\n```step\n@id other"+n+"\nGET /"+n+"\n```\n"), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	rep, err := runLint(lintOptions{Paths: []string{dir}, Rules: []string{"duplicate-step-block"}})
	if err != nil {
		t.Fatal(err)
	}
	if len(rep.Findings) != 3 || !strings.Contains(rep.Findings[0].Suggestion, "@use") {
		t.Fatalf("findings = %+v", rep.Findings)
	}
	// Two files are not enough.
	if err := os.Remove(filepath.Join(dir, "c.flow.md")); err != nil {
		t.Fatal(err)
	}
	rep, _ = runLint(lintOptions{Paths: []string{dir}, Rules: []string{"duplicate-step-block"}})
	if len(rep.Findings) != 0 {
		t.Fatalf("2 files must not be reported: %+v", rep.Findings)
	}
}

// ---- missing-assert / unreferenced-capture / invalid-flow --------------------

func TestMissingAssertAndDefaults(t *testing.T) {
	src := "```step\n@id a\nGET /a\n```\n\n```step\n@id b\nGET /b\n\n[Soft Asserts]\nstatus == 200\n```\n\n```step\n@id c\n@type exec\n\necho hi\n```\n"
	got := lintOne(t, src, "missing-assert")
	if len(got) != 1 || got[0].Step != "a" {
		t.Fatalf("findings = %+v", got)
	}
	withDefault := "```flow\n@flow id=d\n@default-assert status == 200\n```\n\n```step\n@id a\nGET /a\n```\n"
	if got := lintOne(t, withDefault, "missing-assert"); len(got) != 0 {
		t.Fatalf("a flow-level default assertion counts: %+v", got)
	}
}

func TestUnreferencedCapture(t *testing.T) {
	src := "```step\n@id a\nPOST /a\n\n[Captures]\nused = id\nunused = other\n```\n\n```step\n@id b\nGET /b/{{used}}\n```\n"
	got := lintOne(t, src, "unreferenced-capture")
	if len(got) != 1 || !strings.Contains(got[0].Message, `"unused"`) {
		t.Fatalf("findings = %+v", got)
	}
	// Used only in a teardown step still counts.
	src2 := "```step\n@id a\nPOST /a\n\n[Captures]\nid = id\n```\n\n```teardown\nDELETE /a/{{id}}\n```\n"
	if got := lintOne(t, src2, "unreferenced-capture"); len(got) != 0 {
		t.Fatalf("teardown usage must count: %+v", got)
	}
}

func TestInvalidFlowIsAnError(t *testing.T) {
	src := "```step\n@id a\nGET /a\n```\n\n```step\n@id a\nGET /b\n```\n\n```step\n@id nourl\nnonsense\n```\n\n" + edgeBlock("a", "ghost", "success") +
		"```edge\n@from a\n```\n"
	dir := t.TempDir()
	p := filepath.Join(dir, "bad.flow.md")
	_ = os.WriteFile(p, []byte(src), 0o644)
	rep, err := runLint(lintOptions{Paths: []string{p}, Rules: []string{"invalid-flow"}})
	if err != nil {
		t.Fatal(err)
	}
	if rep.OK || rep.Summary.Errors < 4 {
		t.Fatalf("expected >=4 errors, got %+v", rep.Summary)
	}
}

func TestInvalidFlowReportsBrokenUse(t *testing.T) {
	got := lintOne(t, "# t\n\n```flow\n@flow id=x\n@use ./nope.flow.md\n```\n\n```step\nGET /a\n```\n", "invalid-flow")
	if len(got) != 1 || got[0].Line != 5 || !strings.Contains(got[0].Message, "file not found") {
		t.Fatalf("findings = %+v", got)
	}
}

// ---- driver ------------------------------------------------------------------

func TestLintRuleSelectionAndExitSemantics(t *testing.T) {
	dir := t.TempDir()
	_ = os.WriteFile(filepath.Join(dir, "a.flow.md"), []byte("```step\n@id a\nGET /a\n```\n"), 0o644)
	if _, err := runLint(lintOptions{Paths: []string{dir}, Rules: []string{"nope"}}); err == nil {
		t.Fatal("unknown rule must be an error")
	}
	rep, _ := runLint(lintOptions{Paths: []string{dir}})
	if rep.Summary.Warnings == 0 || !rep.OK {
		t.Fatalf("warnings should not fail by default: %+v", rep.Summary)
	}
	rep, _ = runLint(lintOptions{Paths: []string{dir}, FailOn: "warning"})
	if rep.OK {
		t.Fatal("--fail-on warning must fail")
	}
	rep, _ = runLint(lintOptions{Paths: []string{dir}, Ignore: []string{"missing-assert"}, FailOn: "warning"})
	if !rep.OK {
		t.Fatalf("disabled rule still reported: %+v", rep.Findings)
	}
}

func TestLintDiscoversRecursivelyAndSkipsNodeModules(t *testing.T) {
	dir := t.TempDir()
	writeTree(t, dir, map[string]string{
		"a.flow.md":                  "```step\nGET /a\n```\n",
		"sub/deep/b.flow.md":         "```step\nGET /b\n```\n",
		"node_modules/pkg/c.flow.md": "```step\nGET /c\n```\n",
		"notes.md":                   "# not a flow\n",
		".git/hooks/ignored.flow.md": "```step\nGET /d\n```\n",
	})
	got, err := discoverLintFiles([]string{dir})
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 2 {
		t.Fatalf("files = %v", got)
	}
}

func TestLintFixAcrossAllRulesKeepsPlanAndIsIdempotent(t *testing.T) {
	src := "# All\n\n```flow\n@flow id=all\n```\n\n" +
		stepBlock("a", "POST /a\n\n{\"x\":1}\n\n[Captures]\nid = id", "status == 200")[:0] +
		"```step\n@id a\nPOST /a\n\n{\"x\":1}\n\n[Captures]\nid = id\n\n[Asserts]\nstatus == 200\n```\n\n" +
		edgeBlock("a", "b", "success") +
		stepBlock("b", "GET /b/{{id}}", "status == 200") +
		edgeBlock("b", "c", "success") +
		"```step\n@id c\nDELETE /a/{{id}}\n```\n"
	rep, fixed, p := fixFile(t, src)
	if len(rep.Fixes) != 1 || rep.Fixes[0].Applied != 3 {
		t.Fatalf("fixes = %+v skipped=%+v", rep.Fixes, rep.Skipped)
	}
	before, _ := ParseFlowDocument(src)
	after, _ := ParseFlowDocument(fixed)
	if !flowPlansEquivalent(BuildFlowPlan(before), BuildFlowPlan(after)) {
		t.Fatalf("plans differ:\n%s", fixed)
	}
	rep2, _ := runLint(lintOptions{Paths: []string{p}, Fix: true})
	again, _ := os.ReadFile(p)
	if len(rep2.Fixes) != 0 || string(again) != fixed {
		t.Fatalf("second --fix changed the file: %+v", rep2.Fixes)
	}
}
