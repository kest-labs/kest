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
