package example

import "testing"

func TestNormalizeAIExampleCategories(t *testing.T) {
	got := normalizeAIExampleCategories([]string{"positive", "security", "security", "unknown", " boundary "})
	want := []string{"positive", "security", "boundary"}
	if len(got) != len(want) {
		t.Fatalf("expected %d categories, got %d: %#v", len(want), len(got), got)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("category %d: expected %q, got %q", i, want[i], got[i])
		}
	}
}

func TestNormalizeExampleAssertionsAddsStatusAssertion(t *testing.T) {
	got := normalizeExampleAssertions([]Assertion{
		{
			Type:     " body_contains ",
			Operator: " contains ",
			Expect:   "ok",
		},
	}, 422)
	if len(got) != 2 {
		t.Fatalf("expected status assertion plus original assertion, got %#v", got)
	}
	if got[0].Type != "status" || got[0].Operator != "equals" || got[0].Expect != 422 {
		t.Fatalf("unexpected generated status assertion: %#v", got[0])
	}
	if got[1].Type != "body_contains" || got[1].Operator != "contains" {
		t.Fatalf("unexpected normalized custom assertion: %#v", got[1])
	}
}

func TestNormalizeExampleAssertionsInfersContentTypeHeaderPath(t *testing.T) {
	got := normalizeExampleAssertions([]Assertion{
		{
			Type:     "header",
			Operator: "contains",
			Expect:   "application/json",
			Message:  "Response must return JSON content type.",
		},
	}, 200)
	if len(got) != 2 {
		t.Fatalf("expected generated status assertion plus header assertion, got %#v", got)
	}
	if got[1].Path != "Content-Type" {
		t.Fatalf("expected Content-Type header path, got %q", got[1].Path)
	}
}

func TestParseAIExampleDraftsAcceptsEnvelope(t *testing.T) {
	got, err := parseAIExampleDrafts(`{"examples":[{"name":"Happy path","category":"positive","method":"GET","url":"{{base_url}}/health","assertions":[{"type":"status","operator":"equals","expect":200}],"response_status":200}]}`)
	if err != nil {
		t.Fatalf("expected envelope to parse: %v", err)
	}
	if len(got) != 1 || got[0].Name != "Happy path" {
		t.Fatalf("unexpected parsed examples: %#v", got)
	}
}

func TestParseAIExampleDraftsAcceptsDirectArray(t *testing.T) {
	got, err := parseAIExampleDrafts("```json\n[{\"name\":\"Missing token\",\"category\":\"negative\",\"method\":\"GET\",\"url\":\"{{base_url}}/health\",\"assertions\":[{\"type\":\"status\",\"operator\":\"equals\",\"expect\":401}],\"response_status\":401}]\n```")
	if err != nil {
		t.Fatalf("expected direct array to parse: %v", err)
	}
	if len(got) != 1 || got[0].Category != "negative" {
		t.Fatalf("unexpected parsed examples: %#v", got)
	}
}

func TestParseAIExampleDraftsIgnoresTrailingContent(t *testing.T) {
	got, err := parseAIExampleDrafts(`{"examples":[{"name":"Boundary","category":"boundary","method":"GET","url":"{{base_url}}/health","assertions":[{"type":"status","operator":"equals","expect":400}],"response_status":400}]}, {"ignored": true}`)
	if err != nil {
		t.Fatalf("expected first JSON value to parse: %v", err)
	}
	if len(got) != 1 || got[0].Name != "Boundary" {
		t.Fatalf("unexpected parsed examples: %#v", got)
	}
}
