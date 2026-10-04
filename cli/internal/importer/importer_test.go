package importer

import (
	"reflect"
	"strings"
	"testing"
)

func TestVarName(t *testing.T) {
	cases := map[string]string{
		"baseUrl":      "base_url",
		"userID":       "user_id",
		"APIKey":       "api_key",
		"api-key":      "api_key",
		"Access Token": "access_token",
		"page.size":    "page_size",
		"2fa":          "v_2fa",
		"$timestamp":   "$timestamp",
		"already_ok":   "already_ok",
	}
	for in, want := range cases {
		if got := VarName(in); got != want {
			t.Errorf("VarName(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestRenameVars(t *testing.T) {
	var unknown []string
	got := renameVars(`{{baseUrl}}/u/{{ userId }}?t={{$guid}}&x={{$randomColor}}&d={{name | default: "a"}}`, func(v string) { unknown = append(unknown, v) })
	want := `{{base_url}}/u/{{user_id}}?t={{$uuid}}&x={{$randomColor}}&d={{name| default: "a"}}`
	if got != want {
		t.Fatalf("renameVars = %q, want %q", got, want)
	}
	if !reflect.DeepEqual(unknown, []string{"$randomColor"}) {
		t.Fatalf("unknown = %v", unknown)
	}
}

func TestTranslateTestScript(t *testing.T) {
	cases := []struct {
		name         string
		script       string
		asserts      []string
		captures     []string
		untranslated bool
	}{
		{
			name:    "status forms",
			script:  "pm.response.to.have.status(201);\npm.expect(pm.response.code).to.equal(201);\npm.response.to.be.success;",
			asserts: []string{"status == 201", "status >= 200", "status < 300"},
		},
		{
			name: "json equality and captures",
			script: `pm.test("works", function () {
  const data = pm.response.json();
  pm.expect(data.items[0]['id']).to.eql(7);
  pm.expect(data.name).to.eql('Kest');
  pm.expect(data.meta).to.have.property("total");
  pm.expect(data.items).to.have.lengthOf(3);
  pm.environment.set("firstId", data.items[0].id);
});`,
			asserts:  []string{"body.items[0].id == 7", `body.name == "Kest"`, "body.meta.total exists", "body.items length == 3"},
			captures: []string{"first_id = items[0].id"},
		},
		{
			name:         "partial translation keeps safe statements",
			script:       "pm.response.to.have.status(200);\npm.expect(pm.response.headers.get('X')).to.eql('1');",
			asserts:      []string{"status == 200"},
			untranslated: true,
		},
		{
			name:         "control flow blocks everything",
			script:       "if (pm.response.code === 200) {\n  pm.response.to.have.status(200);\n}",
			untranslated: true,
		},
		{
			name:    "keywords inside strings are not control flow",
			script:  `pm.test("should do the thing if ok", function () { pm.response.to.have.status(200); });`,
			asserts: []string{"status == 200"},
		},
		{
			name:         "unsafe literal is not translated",
			script:       "var j = pm.response.json();\npm.expect(j.msg).to.eql('a == b');",
			untranslated: true,
		},
		{
			name:    "legacy tests syntax and response time",
			script:  "tests[\"Status code is 200\"] = responseCode.code === 200;\npm.expect(pm.response.responseTime).to.be.below(500);",
			asserts: []string{"status == 200", "duration < 500"},
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := translateTestScript(strings.Split(tc.script, "\n"))
			if !reflect.DeepEqual(got.Asserts, tc.asserts) {
				t.Errorf("asserts = %q, want %q", got.Asserts, tc.asserts)
			}
			if !reflect.DeepEqual(got.Captures, tc.captures) {
				t.Errorf("captures = %q, want %q", got.Captures, tc.captures)
			}
			if got.Untranslated != tc.untranslated {
				t.Errorf("untranslated = %v, want %v", got.Untranslated, tc.untranslated)
			}
		})
	}
}

func TestSplitShellWords(t *testing.T) {
	in := "curl -H 'A: b c' -d \"x \\\"y\\\"\" $'line\\none' plain\\ word \\\n --compressed"
	want := []string{"curl", "-H", "A: b c", "-d", `x "y"`, "line\none", "plain word", "--compressed"}
	got, err := SplitShellWords(in)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("got %q, want %q", got, want)
	}
	if _, err := SplitShellWords("curl 'oops"); err == nil {
		t.Fatalf("expected unterminated quote error")
	}
	args := []string{"curl", "-d", `{"a": "it's"}`, "https://x.test/a?b=1"}
	round, err := SplitShellWords(ShellJoin(args))
	if err != nil || !reflect.DeepEqual(round, args) {
		t.Fatalf("ShellJoin round trip = %q (%v)", round, err)
	}
}

func TestSanitizeHeader(t *testing.T) {
	cases := []struct{ name, value, want, v string }{
		{"Authorization", "Bearer abc", "Bearer {{token}}", "token"},
		{"Authorization", "Basic dXNlcjpwYXNz", "Basic {{basic_auth}}", "basic_auth"},
		{"Authorization", "Token xyz", "Token {{auth_token}}", "auth_token"},
		{"X-API-Key", "k", "{{api_key}}", "api_key"},
		{"Authorization", "Bearer {{token}}", "Bearer {{token}}", ""},
		{"Accept", "application/json", "application/json", ""},
	}
	for _, tc := range cases {
		got, v := sanitizeHeader(tc.name, tc.value)
		if got != tc.want || v != tc.v {
			t.Errorf("sanitizeHeader(%q, %q) = %q, %q; want %q, %q", tc.name, tc.value, got, v, tc.want, tc.v)
		}
	}
}

func TestRenderNoteNeverCreatesStepBlocks(t *testing.T) {
	f := FlowFile{
		FileName:    "x.flow.md",
		ID:          "x",
		Name:        "X",
		Description: "```step\nGET /evil\n```",
		Sections: []Section{{Steps: []Step{{
			ID: "a", Name: "A", Method: "GET", URL: "/a",
			Notes: []Note{{Title: "script", Lang: "javascript", Content: "```step\nGET /also-evil\n```"}},
		}}}},
	}
	out := Render(f)
	if strings.Count(out, "\n```step") != 2 { // the real step + the one inside the ~~~ note fence
		t.Fatalf("unexpected render:\n%s", out)
	}
	if !strings.Contains(out, "~~~javascript") || !strings.Contains(out, "> ```step") {
		t.Fatalf("expected note to use ~~~ fence and description to be quoted:\n%s", out)
	}
}
