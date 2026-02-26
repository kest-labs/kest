package main

import (
	"strings"
	"testing"
)

func TestParseFlowDocument(t *testing.T) {
	content := `
# Title

~~~flow
@flow id=user-flow
@name User Flow
@tags auth, user
~~~

` + "```step" + `
@id login
@name Login
@retry 2
@max-duration 1500
POST /login
[Queries]
q = kest
page = 1
[Headers]
Content-Type: application/json

{"foo":"bar"}
[Asserts]
status == 200
` + "```" + `

` + "```edge" + `
@from login
@to profile
@on success
` + "```" + `

` + "```kest" + `
GET /health
` + "```" + `
`

	doc, legacy := ParseFlowDocument(content)
	if doc.Meta.ID != "user-flow" {
		t.Fatalf("expected flow id user-flow, got %q", doc.Meta.ID)
	}
	if len(doc.Steps) != 1 {
		t.Fatalf("expected 1 step, got %d", len(doc.Steps))
	}
	if doc.Steps[0].ID != "login" {
		t.Fatalf("expected step id login, got %q", doc.Steps[0].ID)
	}
	if doc.Steps[0].Retry != 2 || doc.Steps[0].MaxDuration != 1500 {
		t.Fatalf("expected retry/max-duration parsed, got retry=%d max=%d", doc.Steps[0].Retry, doc.Steps[0].MaxDuration)
	}
	if doc.Steps[0].Request.Method != "post" || doc.Steps[0].Request.URL != "/login" {
		t.Fatalf("expected request parsed, got method=%q url=%q", doc.Steps[0].Request.Method, doc.Steps[0].Request.URL)
	}
	if len(doc.Steps[0].Request.Queries) != 2 || len(doc.Steps[0].Request.Headers) != 1 {
		t.Fatalf("expected queries/headers parsed, got queries=%v headers=%v", doc.Steps[0].Request.Queries, doc.Steps[0].Request.Headers)
	}
	if len(doc.Edges) != 1 || doc.Edges[0].From != "login" || doc.Edges[0].To != "profile" {
		t.Fatalf("edge parse failed: %+v", doc.Edges)
	}
	if len(legacy) != 1 || !strings.Contains(legacy[0].Raw, "GET /health") {
		t.Fatalf("legacy block parse failed: %+v", legacy)
	}
}

func TestFlowToMermaid(t *testing.T) {
	doc := FlowDoc{
		Steps: []FlowStep{
			{ID: "login", Name: "Login"},
			{ID: "profile", Name: "Profile"},
		},
		Edges: []FlowEdge{
			{From: "login", To: "profile", On: "success"},
		},
	}
	out := FlowToMermaid(doc)
	if !strings.Contains(out, "login -->|success| profile") {
		t.Fatalf("unexpected mermaid output: %s", out)
	}
}

func TestParseFlowMarkdownSupportsInfoString(t *testing.T) {
	content := `
` + "```step title=\"Login\"" + `
@id login
POST /login
` + "```" + `
`
	blocks := ParseFlowMarkdown(content)
	if len(blocks) != 1 || blocks[0].Kind != "step" {
		t.Fatalf("expected step block, got %+v", blocks)
	}
}

func TestOrderFlowStepsByEdge(t *testing.T) {
	doc := FlowDoc{
		Steps: []FlowStep{
			{ID: "b"},
			{ID: "a"},
			{ID: "c"},
		},
		Edges: []FlowEdge{
			{From: "a", To: "b"},
			{From: "b", To: "c"},
		},
	}
	ordered := orderFlowSteps(doc)
	if len(ordered) != 3 || ordered[0].ID != "a" || ordered[1].ID != "b" || ordered[2].ID != "c" {
		t.Fatalf("unexpected order: %+v", ordered)
	}
}

func TestEnsureStepIDs(t *testing.T) {
	doc, _ := ParseFlowDocument("```step\nPOST /ping\n```")
	if len(doc.Steps) != 1 || doc.Steps[0].ID == "" {
		t.Fatalf("expected auto id, got %+v", doc.Steps)
	}
}

func TestFlowBlockWithNonDirectivesIsLegacy(t *testing.T) {
	content := `
` + "```flow" + `
POST /legacy
` + "```" + `
`
	doc, legacy := ParseFlowDocument(content)
	if doc.Meta.ID != "" || len(doc.Steps) != 0 {
		t.Fatalf("expected no flow meta/steps, got %+v", doc)
	}
	if len(legacy) != 1 || !strings.Contains(legacy[0].Raw, "POST /legacy") {
		t.Fatalf("expected legacy block, got %+v", legacy)
	}
}

func TestEdgeMissingFieldsIgnored(t *testing.T) {
	content := `
` + "```edge" + `
@from login
` + "```" + `
`
	doc, _ := ParseFlowDocument(content)
	if len(doc.Edges) != 0 {
		t.Fatalf("expected no edges, got %+v", doc.Edges)
	}
}

func TestOrderFlowStepsCycleFallsBack(t *testing.T) {
	doc := FlowDoc{
		Steps: []FlowStep{
			{ID: "a"},
			{ID: "b"},
		},
		Edges: []FlowEdge{
			{From: "a", To: "b"},
			{From: "b", To: "a"},
		},
	}
	ordered := orderFlowSteps(doc)
	if len(ordered) != 2 || ordered[0].ID != "a" || ordered[1].ID != "b" {
		t.Fatalf("expected original order fallback, got %+v", ordered)
	}
}

// TestParseFlowStepCapturesAndAssertsSurviveParseBlock is a regression test for
// the bug where ParseBlock overwrote step.Request entirely, wiping out [Captures]
// and [Asserts] that were collected during the section-parsing loop.
func TestParseFlowStepCapturesAndAssertsSurviveParseBlock(t *testing.T) {
	content := "```step\n" +
		"@id get-token\n" +
		"POST /v1/auth/login\n" +
		"Content-Type: application/json\n" +
		"\n" +
		`{"email":"user@example.com","password":"secret"}` + "\n" +
		"[Captures]\n" +
		"token = data.token\n" +
		"user_id = data.user.id\n" +
		"[Asserts]\n" +
		"status == 200\n" +
		"body.data.token exists\n" +
		"```"

	doc, _ := ParseFlowDocument(content)
	if len(doc.Steps) != 1 {
		t.Fatalf("expected 1 step, got %d", len(doc.Steps))
	}
	step := doc.Steps[0]

	if len(step.Request.Captures) != 2 {
		t.Fatalf("expected 2 captures, got %d: %v", len(step.Request.Captures), step.Request.Captures)
	}
	if step.Request.Captures[0] != "token = data.token" {
		t.Fatalf("unexpected capture[0]: %q", step.Request.Captures[0])
	}

	if len(step.Request.Asserts) != 2 {
		t.Fatalf("expected 2 asserts, got %d: %v", len(step.Request.Asserts), step.Request.Asserts)
	}
	if step.Request.Asserts[0] != "status == 200" {
		t.Fatalf("unexpected assert[0]: %q", step.Request.Asserts[0])
	}

	if step.Request.Method != "post" || step.Request.URL != "/v1/auth/login" {
		t.Fatalf("unexpected method/url: %q %q", step.Request.Method, step.Request.URL)
	}
}

func TestParseFlowStepExecTimeout(t *testing.T) {
	content := "```step\n" +
		"@id seed\n" +
		"@type exec\n" +
		"@timeout 60s\n" +
		"echo OK\n" +
		"```"

	doc, _ := ParseFlowDocument(content)
	if len(doc.Steps) != 1 {
		t.Fatalf("expected 1 step, got %d", len(doc.Steps))
	}
	step := doc.Steps[0]
	if step.ExecTimeoutMs != 60000 {
		t.Fatalf("expected ExecTimeoutMs=60000, got %d", step.ExecTimeoutMs)
	}
}

func TestParseFlowStepRetryWaitAndOnFail(t *testing.T) {
	content := `
` + "```step" + `
@id login
@retry 3
@retry-wait 1000
@on-fail stop
POST /login
` + "```" + `
`
	doc, _ := ParseFlowDocument(content)
	if len(doc.Steps) != 1 {
		t.Fatalf("expected 1 step, got %d", len(doc.Steps))
	}
	step := doc.Steps[0]
	if step.Retry != 3 || step.RetryWait != 1000 || step.OnFail != "stop" {
		t.Fatalf("expected retry/retry-wait/on-fail parsed, got %+v", step)
	}
}
