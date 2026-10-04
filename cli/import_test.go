package main

import (
	"bytes"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/kest-labs/kest/cli/internal/importer"
)

// assertRoundTrip renders every generated file and parses it back with the
// real flow parser, checking that each imported request survives as a step.
func assertRoundTrip(t *testing.T, res *importer.Result) map[string]FlowStep {
	t.Helper()
	steps := map[string]FlowStep{}
	for _, f := range res.Files {
		content := importer.Render(f)
		doc, legacy := ParseFlowDocument(content)
		if len(legacy) != 0 {
			t.Fatalf("%s: expected no legacy blocks, got %d:\n%s", f.FileName, len(legacy), content)
		}
		if doc.Meta.ID != f.ID {
			t.Fatalf("%s: flow id = %q, want %q", f.FileName, doc.Meta.ID, f.ID)
		}
		if len(doc.Steps) != f.StepCount() {
			t.Fatalf("%s: parsed %d steps, want %d:\n%s", f.FileName, len(doc.Steps), f.StepCount(), content)
		}
		ids := map[string]bool{}
		for _, st := range doc.Steps {
			if ids[st.ID] {
				t.Fatalf("%s: duplicate step id %q", f.FileName, st.ID)
			}
			ids[st.ID] = true
			if st.Request.Method == "" || st.Request.URL == "" {
				t.Fatalf("%s: step %q did not parse as a request: %+v", f.FileName, st.ID, st.Request)
			}
			for _, h := range st.Request.Headers {
				if !strings.Contains(h, ":") {
					t.Fatalf("%s: step %q has malformed header %q", f.FileName, st.ID, h)
				}
			}
			steps[f.FileName+"#"+st.ID] = st
		}
	}
	return steps
}

func readFixture(t *testing.T, name string) []byte {
	t.Helper()
	data, err := os.ReadFile(filepath.Join("testdata", "import", name))
	if err != nil {
		t.Fatal(err)
	}
	return data
}

func allOutput(res *importer.Result) string {
	var b strings.Builder
	for _, f := range res.Files {
		b.WriteString(importer.Render(f))
	}
	b.WriteString(importer.RenderEnvSnippet(res.Env))
	for _, w := range res.Warnings {
		b.WriteString(w.String())
	}
	return b.String()
}

func TestImportPostmanRoundTrip(t *testing.T) {
	res, err := importer.ImportPostman(readFixture(t, "postman_v21.json"), importer.PostmanOptions{
		Environment: readFixture(t, "postman_env.json"),
	})
	if err != nil {
		t.Fatal(err)
	}
	steps := assertRoundTrip(t, res)
	if got := res.RequestCount(); got != 8 {
		t.Fatalf("request count = %d, want 8", got)
	}
	if len(res.Files) != 4 {
		t.Fatalf("files = %d, want 4 (root requests + 3 top-level folders)", len(res.Files))
	}

	login := steps["auth.flow.md#login"]
	if login.Request.Method != "post" || login.Request.URL != "/auth/login" {
		t.Fatalf("login request = %s %s", login.Request.Method, login.Request.URL)
	}
	if !json.Valid([]byte(login.Request.Data)) || !strings.Contains(login.Request.Data, "{{user_email}}") || !strings.Contains(login.Request.Data, "{{$uuid}}") {
		t.Fatalf("login body not translated: %s", login.Request.Data)
	}
	wantAsserts := []string{"status == 200", `body.token_type == "Bearer"`, "body.user.active == true"}
	if strings.Join(login.Request.Asserts, "|") != strings.Join(wantAsserts, "|") {
		t.Fatalf("login asserts = %q, want %q", login.Request.Asserts, wantAsserts)
	}
	wantCaptures := []string{"access_token = access_token", "user_id = user.id"}
	if strings.Join(login.Request.Captures, "|") != strings.Join(wantCaptures, "|") {
		t.Fatalf("login captures = %q, want %q", login.Request.Captures, wantCaptures)
	}

	list := steps["orders.flow.md#list-orders"]
	if strings.Join(list.Request.Queries, "&") != "limit={{page_size}}&status=open" {
		t.Fatalf("list orders queries = %q", list.Request.Queries)
	}
	if !containsString(list.Request.Headers, "X-Partner-Key: {{partner_key}}") {
		t.Fatalf("folder apikey auth not inherited: %q", list.Request.Headers)
	}
	if len(list.Request.Asserts) != 0 {
		t.Fatalf("script with control flow must not be partially translated, got %q", list.Request.Asserts)
	}

	ship := steps["orders.flow.md#ship-order"]
	if ship.Request.URL != "/orders/{{order_id}}/ship" || ship.Request.Data != "carrier=UPS+Ground&order_id={{order_id}}" {
		t.Fatalf("ship order = %s %q", ship.Request.URL, ship.Request.Data)
	}
	if !containsString(ship.Request.Headers, "Authorization: Basic {{$basicAuth(warehouse_user, warehouse_password)}}") {
		t.Fatalf("basic auth not mapped: %q", ship.Request.Headers)
	}

	get := steps["orders.flow.md#get-order"]
	if get.Request.URL != "/orders/{{order_id}}" {
		t.Fatalf("path variable not converted: %s", get.Request.URL)
	}
	if strings.Join(get.Request.Asserts, "|") != "status >= 200|status < 300" {
		t.Fatalf("request without a test script should default to a 2xx check, got %q", get.Request.Asserts)
	}
	health := steps["acme-store-api.flow.md#health"]
	for _, h := range health.Request.Headers {
		if strings.HasPrefix(h, "Authorization") {
			t.Fatalf("noauth request must not inherit collection auth: %q", h)
		}
	}
	gql := steps["search.flow.md#graphql-search"]
	if !json.Valid([]byte(gql.Request.Data)) || !containsString(gql.Request.Headers, "Authorization: Bearer {{access_token}}") {
		t.Fatalf("graphql step = %q %q", gql.Request.Headers, gql.Request.Data)
	}

	// Environment: base URL from the env file, secrets withheld.
	if res.Env.BaseURL != "https://staging.acme.test/v1" || res.Env.Name != "acme_staging" {
		t.Fatalf("env = %+v", res.Env)
	}
	if res.Env.Variables["user_email"] != "qa@acme.test" || res.Env.Variables["page_size"] != "20" {
		t.Fatalf("env variables = %v", res.Env.Variables)
	}
	out := allOutput(res)
	for _, secret := range []string{"Sup3rS3cret!", "do-not-copy-me", "sk_live_hardcoded123", "pk_staging_abc"} {
		if strings.Contains(out, secret) {
			t.Fatalf("secret %q leaked into generated output", secret)
		}
	}
	if _, ok := res.Env.Variables["legacy_flag"]; ok {
		t.Fatalf("disabled env value must be skipped")
	}

	// Untranslatable content is preserved and counted.
	if len(res.Warnings) < 5 {
		t.Fatalf("expected warnings for scripts/form-data/literal key, got %v", res.Warnings)
	}
	orders := importer.Render(res.Files[2])
	if !strings.Contains(orders, "body.items.forEach") || !strings.Contains(orders, "new Date().toISOString()") || !strings.Contains(orders, "label=@/tmp/label.pdf") {
		t.Fatalf("untranslated content was not preserved:\n%s", orders)
	}
}

func TestImportPostmanV20(t *testing.T) {
	collection := `{
  "info": {"name": "Legacy", "schema": "https://schema.getpostman.com/json/collection/v2.0.0/collection.json"},
  "auth": {"type": "bearer", "bearer": {"token": "{{token}}"}},
  "item": [
    {"name": "Ping", "request": "https://legacy.test/ping"},
    {"name": "Create", "request": {
      "method": "POST",
      "url": "https://legacy.test/things?x=1",
      "header": "Content-Type: application/json\nX-Trace: abc",
      "body": {"mode": "raw", "raw": "{\"a\": 1}"}
    },
    "event": [{"listen": "test", "script": {"exec": "tests[\"ok\"] = responseCode.code === 201;"}}]}
  ]
}`
	res, err := importer.ImportPostman([]byte(collection), importer.PostmanOptions{})
	if err != nil {
		t.Fatal(err)
	}
	steps := assertRoundTrip(t, res)
	create := steps["legacy.flow.md#create"]
	if create.Request.URL != "/things" || strings.Join(create.Request.Queries, "&") != "x=1" {
		t.Fatalf("create = %s %q", create.Request.URL, create.Request.Queries)
	}
	if !containsString(create.Request.Asserts, "status == 201") || !containsString(create.Request.Headers, "Authorization: Bearer {{token}}") {
		t.Fatalf("create = %q %q", create.Request.Asserts, create.Request.Headers)
	}
	if res.Env.BaseURL != "https://legacy.test" {
		t.Fatalf("base url = %q", res.Env.BaseURL)
	}
}

func TestImportPostmanRejectsV1(t *testing.T) {
	_, err := importer.ImportPostman([]byte(`{"id":"x","name":"old","requests":[{"url":"http://a"}]}`), importer.PostmanOptions{})
	if err == nil || !strings.Contains(err.Error(), "v1") {
		t.Fatalf("expected v1 error, got %v", err)
	}
}

func TestImportOpenAPIRoundTrip(t *testing.T) {
	res, err := importer.ImportOpenAPI(filepath.Join("testdata", "import", "openapi.yaml"), importer.OpenAPIOptions{})
	if err != nil {
		t.Fatal(err)
	}
	steps := assertRoundTrip(t, res)
	if res.RequestCount() != 6 || len(res.Files) != 3 {
		t.Fatalf("got %d requests in %d files", res.RequestCount(), len(res.Files))
	}
	if res.Env.BaseURL != "https://eu.petclinic.test/api" {
		t.Fatalf("base url = %q", res.Env.BaseURL)
	}
	create := steps["owners.smoke.flow.md#create-owner"]
	if !containsString(create.Request.Asserts, "status == 201") {
		t.Fatalf("create owner asserts = %q", create.Request.Asserts)
	}
	var body map[string]any
	if err := json.Unmarshal([]byte(create.Request.Data), &body); err != nil {
		t.Fatalf("create owner body is not JSON: %v\n%s", err, create.Request.Data)
	}
	if body["firstName"] != "Ada" || body["email"] != "user@example.com" {
		t.Fatalf("example body = %v", body)
	}
	if _, ok := body["id"]; ok {
		t.Fatalf("readOnly property must not be in the example body")
	}
	getOwner := steps["owners.smoke.flow.md#get-owner"]
	if getOwner.Request.URL != "/owners/{{owner_id}}" || !containsString(getOwner.Request.Asserts, "status >= 200") {
		t.Fatalf("get owner = %s %q", getOwner.Request.URL, getOwner.Request.Asserts)
	}
	del := steps["owners.smoke.flow.md#delete-owner"]
	if !containsString(del.Request.Headers, "X-Admin-Key: {{api_key_auth}}") || !containsString(del.Request.Asserts, "status == 204") {
		t.Fatalf("delete owner = %q %q", del.Request.Headers, del.Request.Asserts)
	}
	health := steps["default.smoke.flow.md#get-health"]
	if len(health.Request.Headers) != 0 {
		t.Fatalf("operation with security: [] must not get auth headers: %q", health.Request.Headers)
	}
	list := steps["owners.smoke.flow.md#list-owners"]
	if strings.Join(list.Request.Queries, "&") != "limit=20" {
		t.Fatalf("required query params = %q", list.Request.Queries)
	}
}

func TestImportSwagger2(t *testing.T) {
	res, err := importer.ImportOpenAPI(filepath.Join("testdata", "import", "swagger2.json"), importer.OpenAPIOptions{})
	if err != nil {
		t.Fatal(err)
	}
	steps := assertRoundTrip(t, res)
	if res.Env.BaseURL != "https://inventory.legacy.test/v2" {
		t.Fatalf("base url = %q", res.Env.BaseURL)
	}
	if got := steps["items.smoke.flow.md#get-item"].Request.URL; got != "/items/{{sku}}" {
		t.Fatalf("get item url = %q", got)
	}
}

func TestImportCurlRoundTrip(t *testing.T) {
	cases := []struct {
		name       string
		cmd        string
		method     string
		url        string
		queries    string
		dataSubstr string
		header     string
	}{
		{
			name:       "json post with bearer",
			cmd:        `curl -sS -X POST 'https://api.example.com/v1/users?invite=true' -H 'Content-Type: application/json' -H 'Authorization: Bearer abc.def' --data-raw '{"name":"kest"}'`,
			method:     "post",
			url:        "/v1/users",
			queries:    "invite=true",
			dataSubstr: `"name": "kest"`,
			header:     "Authorization: Bearer {{token}}",
		},
		{
			name:    "get with -G and basic auth over multiple lines",
			cmd:     "curl 'https://api.example.com/search' \\\n  -G --data-urlencode 'q=hello world' \\\n  -u admin:hunter2",
			method:  "get",
			url:     "/search",
			queries: "q=hello world",
			header:  "Authorization: Basic {{$basicAuth(basic_username, basic_password)}}",
		},
		{
			name:       "--json implies POST and headers",
			cmd:        `curl --json '{"a":1}' https://x.test/items`,
			method:     "post",
			url:        "/items",
			dataSubstr: `"a": 1`,
			header:     "Accept: application/json",
		},
		{
			name:       "form data defaults to urlencoded",
			cmd:        `curl https://x.test/login -d user=a -d pass=b`,
			method:     "post",
			url:        "/login",
			dataSubstr: "user=a&pass=b",
			header:     "Content-Type: application/x-www-form-urlencoded",
		},
		{
			name:   "combined short flags",
			cmd:    `curl -XDELETE -sSL https://x.test/items/1 -HX-Trace:\ 1`,
			method: "delete",
			url:    "/items/1",
			header: "X-Trace: 1",
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			res, err := importer.ImportCurl(tc.cmd, importer.CurlOptions{})
			if err != nil {
				t.Fatal(err)
			}
			steps := assertRoundTrip(t, res)
			if len(steps) != 1 {
				t.Fatalf("expected 1 step, got %d", len(steps))
			}
			var st FlowStep
			for _, s := range steps {
				st = s
			}
			if st.Request.Method != tc.method || st.Request.URL != tc.url {
				t.Fatalf("request = %s %s", st.Request.Method, st.Request.URL)
			}
			if strings.Join(st.Request.Queries, "&") != tc.queries {
				t.Fatalf("queries = %q, want %q", st.Request.Queries, tc.queries)
			}
			if !strings.Contains(st.Request.Data, tc.dataSubstr) {
				t.Fatalf("data = %q, want substring %q", st.Request.Data, tc.dataSubstr)
			}
			if tc.header != "" && !containsString(st.Request.Headers, tc.header) {
				t.Fatalf("headers = %q, want %q", st.Request.Headers, tc.header)
			}
			if out := allOutput(res); strings.Contains(out, "hunter2") || strings.Contains(out, "abc.def") {
				t.Fatalf("credential leaked:\n%s", out)
			}
			// The bare step block printed to stdout must parse too.
			doc, _ := ParseFlowDocument(importer.RenderStep(res.Files[0].Sections[0].Steps[0]))
			if len(doc.Steps) != 1 || doc.Steps[0].Request.Method != tc.method {
				t.Fatalf("stdout step block did not parse")
			}
		})
	}
}

func TestImportPostmanCommandWritesFiles(t *testing.T) {
	dir := t.TempDir()
	defer func() { importOutDir, importPostmanEnv, importForce = "", "", false }()
	importOutDir = dir
	importPostmanEnv = filepath.Join("testdata", "import", "postman_env.json")

	var stdout, stderr bytes.Buffer
	importPostmanCmd.SetOut(&stdout)
	importPostmanCmd.SetErr(&stderr)
	if err := importPostmanCmd.RunE(importPostmanCmd, []string{filepath.Join("testdata", "import", "postman_v21.json")}); err != nil {
		t.Fatal(err)
	}
	files, _ := filepath.Glob(filepath.Join(dir, "*.flow.md"))
	if len(files) != 4 {
		t.Fatalf("expected 4 flow files, got %v", files)
	}
	if !strings.Contains(stdout.String(), "base_url: \"https://staging.acme.test/v1\"") {
		t.Fatalf("env snippet missing from output:\n%s", stdout.String())
	}
	if !strings.Contains(stderr.String(), "need manual review") {
		t.Fatalf("warning summary missing:\n%s", stderr.String())
	}
	// A second run must refuse to overwrite without --force.
	if err := importPostmanCmd.RunE(importPostmanCmd, []string{filepath.Join("testdata", "import", "postman_v21.json")}); err == nil {
		t.Fatalf("expected overwrite protection error")
	}
}

func containsString(list []string, want string) bool {
	for _, s := range list {
		if s == want {
			return true
		}
	}
	return false
}
