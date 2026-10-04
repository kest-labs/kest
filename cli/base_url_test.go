package main

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/kest-labs/kest/cli/internal/importer"
)

// newPathServer answers every request with its own path, so tests can tell
// which server (and which path) a request reached.
func newPathServer(t *testing.T, name string) *httptest.Server {
	t.Helper()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"server":"` + name + `","path":"` + r.URL.Path + `"}`))
	}))
	t.Cleanup(server.Close)
	return server
}

func TestVariableAbsoluteURLIgnoresBaseURL(t *testing.T) {
	isolateKest(t)
	base := newPathServer(t, "base")
	other := newPathServer(t, "other")
	t.Setenv("KEST_BASE_URL", base.URL)

	ActiveRunCtx = NewRunContext(map[string]string{"api_root": other.URL + "/v2", "prefix": "/v1"})
	t.Cleanup(func() { ActiveRunCtx = nil })

	tr, err := ExecuteRequest(RequestOptions{Method: "get", URL: "{{api_root}}/users", SilentOutput: true})
	if err != nil {
		t.Fatal(err)
	}
	if tr.URL != other.URL+"/v2/users" || !strings.Contains(tr.ResponseBody, `"server":"other"`) {
		t.Fatalf("absolute variable URL got base_url prepended: url=%s body=%s", tr.URL, tr.ResponseBody)
	}

	// A variable that resolves to a relative path still gets the base URL.
	tr, err = ExecuteRequest(RequestOptions{Method: "get", URL: "{{prefix}}/users", SilentOutput: true})
	if err != nil {
		t.Fatal(err)
	}
	if tr.URL != base.URL+"/v1/users" || !strings.Contains(tr.ResponseBody, `"server":"base"`) {
		t.Fatalf("relative variable URL: url=%s body=%s", tr.URL, tr.ResponseBody)
	}

	// Plain relative paths keep working.
	tr, err = ExecuteRequest(RequestOptions{Method: "get", URL: "/health", SilentOutput: true})
	if err != nil {
		t.Fatal(err)
	}
	if tr.URL != base.URL+"/health" {
		t.Fatalf("relative URL = %s", tr.URL)
	}
}

func TestBaseURLWithVariableIsInterpolated(t *testing.T) {
	isolateKest(t)
	server := newPathServer(t, "base")
	t.Setenv("KEST_BASE_URL", "{{host}}/api")
	ActiveRunCtx = NewRunContext(map[string]string{"host": server.URL})
	t.Cleanup(func() { ActiveRunCtx = nil })

	tr, err := ExecuteRequest(RequestOptions{Method: "get", URL: "/users", SilentOutput: true})
	if err != nil {
		t.Fatal(err)
	}
	if tr.URL != server.URL+"/api/users" {
		t.Fatalf("url = %s", tr.URL)
	}
}

func TestStrictVarsReportsMissingURLVariable(t *testing.T) {
	isolateKest(t)
	t.Setenv("KEST_BASE_URL", "http://127.0.0.1:1")
	_, err := ExecuteRequest(RequestOptions{Method: "get", URL: "{{missing_root}}/users", StrictVars: true, SilentOutput: true})
	if err == nil || !strings.Contains(err.Error(), "missing_root") {
		t.Fatalf("expected missing variable error, got %v", err)
	}
}

func TestFlowStepWithVariableAbsoluteURL(t *testing.T) {
	work := isolateKest(t)
	base := newPathServer(t, "base")
	other := newPathServer(t, "other")
	flow := "# Users\n\n" +
		"```step\n@id users\nGET {{api_root}}/users\n\n" +
		"[Asserts]\nstatus == 200\nbody.server == \"other\"\nbody.path == \"/users\"\n```\n"
	flowName := writeFlow(t, work, "users.flow.md", flow)

	runVars = []string{"api_root=" + other.URL}
	raw, err := runJSON(t, []string{flowName}, base.URL)
	if err != nil {
		t.Fatalf("flow failed: %v\n%s", err, raw)
	}
}

func TestImportPostmanVariableURLHasNoLimitationWarning(t *testing.T) {
	collection := `{
  "info": {"name": "Vars", "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"},
  "item": [
    {"name": "Users", "request": {"method": "GET", "url": "{{base}}/users"}},
    {"name": "Orders", "request": {"method": "GET", "url": "{{base}}/orders"}},
    {"name": "Token", "request": {"method": "POST", "url": "{{auth_root}}/token"}}
  ]
}`
	res, err := importer.ImportPostman([]byte(collection), importer.PostmanOptions{})
	if err != nil {
		t.Fatal(err)
	}
	for _, w := range res.Warnings {
		if strings.Contains(w.Message, "prepends base_url") {
			t.Fatalf("stale limitation warning: %s", w.Message)
		}
	}
	found := false
	for _, st := range assertRoundTrip(t, res) {
		if st.Request.URL == "{{auth_root}}/token" {
			found = true
		}
	}
	if !found {
		t.Fatal("variable-prefixed URL was not kept as-is")
	}
}
