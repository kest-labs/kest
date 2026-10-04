package main

import (
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

const loginInclude = "# Login\n\n" +
	"```flow\n@flow id=login\n@default-assert status == 200\n```\n\n" +
	"```setup\n@id warm\nGET /warm\n```\n\n" +
	"```step\n@id do\n@name Sign in\nPOST /login\nContent-Type: application/json\n\n{\"user\":\"u\"}\n\n[Captures]\ntoken = token\n```\n"

const mainWithUse = "# Main\n\n" +
	"```flow\n@flow id=main\n@use ./common/login.flow.md\n```\n\n" +
	"```step\n@id me\nGET /me\nAuthorization: Bearer {{token}}\n\n[Asserts]\nstatus == 200\n```\n"

func writeTree(t *testing.T, dir string, files map[string]string) {
	t.Helper()
	for name, content := range files {
		p := filepath.Join(dir, name)
		if err := os.MkdirAll(filepath.Dir(p), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(p, []byte(content), 0o644); err != nil {
			t.Fatal(err)
		}
	}
}

func TestParseUseDirectives(t *testing.T) {
	doc, _ := ParseFlowDocument("# x\n\n```flow\n@flow id=a\n@use ./one.flow.md\n@use ./two.flow.md as second\n```\n")
	if len(doc.Meta.Uses) != 2 {
		t.Fatalf("uses = %+v", doc.Meta.Uses)
	}
	if u := doc.Meta.Uses[0]; u.Path != "./one.flow.md" || u.Alias != "" || u.LineNum != 5 {
		t.Errorf("first use = %+v", u)
	}
	if u := doc.Meta.Uses[1]; u.Path != "./two.flow.md" || u.Alias != "second" || u.LineNum != 6 {
		t.Errorf("second use = %+v", u)
	}
}

func TestUseRunsIncludedStepsFirstAndSharesVariables(t *testing.T) {
	work := isolateKest(t)
	srv := newRecordingServer(t)
	writeTree(t, work, map[string]string{"common/login.flow.md": loginInclude})

	res, err := runFlowFile(t, work, "main.flow.md", mainWithUse, srv.URL)
	if err != nil {
		t.Fatalf("run failed: %v", err)
	}
	if got := strings.Join(srv.paths(), ","); got != "GET /warm,POST /login,GET /me" {
		t.Fatalf("request order = %s", got)
	}
	// The unprefixed variable captured by the include is usable afterwards.
	if auth := srv.requests()[2].Authrzn; auth != "Bearer tok-123" {
		t.Fatalf("Authorization = %q", auth)
	}
	// Included steps are namespaced and marked; own steps are not.
	if len(res.Steps) != 3 {
		t.Fatalf("steps = %v", stepNames(res))
	}
	for i, wantName := range []string{"[login] warm", "[login] Sign in", "me"} {
		if res.Steps[i].Name != wantName {
			t.Errorf("step %d name = %q, want %q", i, res.Steps[i].Name, wantName)
		}
	}
	if res.Steps[0].IncludedFrom != "common/login.flow.md" || res.Steps[1].IncludedFrom != "common/login.flow.md" || res.Steps[2].IncludedFrom != "" {
		t.Errorf("included_from = %q / %q / %q", res.Steps[0].IncludedFrom, res.Steps[1].IncludedFrom, res.Steps[2].IncludedFrom)
	}
	// The included file's own default assertion applied to its step; the
	// including file declared none, so "me" only has its explicit one.
	if len(res.Steps[1].Assertions) != 1 || res.Steps[1].Assertions[0].Expr != "status == 200" {
		t.Errorf("included step assertions = %+v", res.Steps[1].Assertions)
	}
}

func TestUseNamespacesAndPlan(t *testing.T) {
	work := isolateKest(t)
	writeTree(t, work, map[string]string{
		"common/login.flow.md": loginInclude,
		"common/seed.flow.md":  "```step\n@id do\nGET /seed\n```\n",
		"main.flow.md": "```flow\n@flow id=m\n@use ./common/login.flow.md\n@use ./common/seed.flow.md as data\n```\n\n" +
			"```step\n@id do\nGET /own\n```\n",
	})
	doc, _, err := loadFlowDocument(filepath.Join(work, "main.flow.md"))
	if err != nil {
		t.Fatal(err)
	}
	var ids []string
	for _, e := range BuildFlowPlan(doc) {
		ids = append(ids, e.ID)
	}
	want := "login.warm,login.do,data.do,do"
	if strings.Join(ids, ",") != want {
		t.Fatalf("plan ids = %v, want %s", ids, want)
	}
	mm := FlowToMermaid(doc)
	if !strings.Contains(mm, "login_do --> data_do") || !strings.Contains(mm, "data_do --> do") {
		t.Fatalf("mermaid should chain included steps:\n%s", mm)
	}
}

func TestUseNestedIncludes(t *testing.T) {
	work := isolateKest(t)
	writeTree(t, work, map[string]string{
		"a/inner.flow.md": "```step\n@id s\nGET /inner\n```\n",
		"a/outer.flow.md": "```flow\n@use ./inner.flow.md\n```\n\n```step\n@id s\nGET /outer\n```\n",
		"main.flow.md":    "```flow\n@use ./a/outer.flow.md\n```\n\n```step\n@id s\nGET /main\n```\n",
	})
	doc, _, err := loadFlowDocument(filepath.Join(work, "main.flow.md"))
	if err != nil {
		t.Fatal(err)
	}
	var ids, urls []string
	for _, e := range BuildFlowPlan(doc) {
		ids = append(ids, e.ID)
		urls = append(urls, e.URL)
	}
	if strings.Join(ids, ",") != "outer.inner.s,outer.s,s" || strings.Join(urls, ",") != "/inner,/outer,/main" {
		t.Fatalf("ids=%v urls=%v", ids, urls)
	}
	if doc.Setup[0].IncludedFrom != "a/inner.flow.md" {
		t.Errorf("nested included_from = %q", doc.Setup[0].IncludedFrom)
	}
}

func TestUseErrors(t *testing.T) {
	work := isolateKest(t)
	writeTree(t, work, map[string]string{
		"a.flow.md":          "```flow\n@use ./b.flow.md\n```\n\n```step\nGET /a\n```\n",
		"b.flow.md":          "```flow\n@use ./a.flow.md\n```\n\n```step\nGET /b\n```\n",
		"self.flow.md":       "# self\n\n```flow\n@use ./self.flow.md\n```\n\n```step\nGET /s\n```\n",
		"dup.flow.md":        "```flow\n@use ./x/c.flow.md\n@use ./y/c.flow.md\n```\n",
		"x/c.flow.md":        "```step\nGET /x\n```\n",
		"y/c.flow.md":        "```step\nGET /y\n```\n",
		"miss.flow.md":       "# m\n\n```flow\n@flow id=m\n\n@use ./nope.flow.md\n```\n",
		"empty.flow.md":      "# nothing here\n",
		"uses-empty.flow.md": "```flow\n@use ./empty.flow.md\n```\n",
	})
	cases := []struct{ file, want string }{
		{"a.flow.md", "b.flow.md:2: @use: include cycle: "},
		{"self.flow.md", "self.flow.md:4: @use: include cycle"},
		{"dup.flow.md", "dup.flow.md:3: @use: namespace \"c\" is already used by the @use on line 2"},
		{"miss.flow.md", "miss.flow.md:6: @use: file not found: ./nope.flow.md"},
		{"uses-empty.flow.md", "contains no setup or step blocks"},
	}
	for _, tc := range cases {
		_, _, err := loadFlowDocument(filepath.Join(work, tc.file))
		if err == nil || !strings.Contains(err.Error(), tc.want) {
			t.Errorf("%s: error = %v, want substring %q", tc.file, err, tc.want)
		}
		if err != nil && !isFlowIncludeError(err) {
			t.Errorf("%s: not a FlowIncludeError: %T", tc.file, err)
		}
	}
}

func TestUseErrorSurfacesInRunResult(t *testing.T) {
	work := isolateKest(t)
	srv := newRecordingServer(t)
	res, err := runFlowFile(t, work, "miss.flow.md", "```flow\n@use ./nope.flow.md\n```\n", srv.URL)
	if err == nil {
		t.Fatal("expected an error")
	}
	var exitErr *ExitError
	if !errors.As(err, &exitErr) || exitErr.Code != ExitConfigError {
		t.Fatalf("expected config exit code, got %v", err)
	}
	if res == nil || len(res.Steps) != 1 || !strings.Contains(res.Steps[0].Error.Message, "file not found") {
		t.Fatalf("result = %+v", res)
	}
	if len(srv.requests()) != 0 {
		t.Fatal("nothing should run when an include is broken")
	}
}

func TestIncludedTeardownRunsAtEnd(t *testing.T) {
	work := isolateKest(t)
	srv := newRecordingServer(t)
	writeTree(t, work, map[string]string{
		"common/res.flow.md": "```step\n@id make\nPOST /res\n```\n\n```teardown\n@id drop\nDELETE /res\n```\n",
	})
	flow := "```flow\n@use ./common/res.flow.md\n```\n\n```step\n@id use\nGET /use\n```\n\n```teardown\n@id own\nDELETE /own\n[Asserts]\nstatus == 204\n```\n"
	if _, err := runFlowFile(t, work, "m.flow.md", flow, srv.URL); err != nil {
		t.Fatal(err)
	}
	if got := strings.Join(srv.paths(), ","); got != "POST /res,GET /use,DELETE /own,DELETE /res" {
		t.Fatalf("order = %s", got)
	}
}
