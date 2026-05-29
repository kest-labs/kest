package request

import (
	"encoding/json"
	"testing"
)

func TestKeyValueJSONRoundTripPreservesDisabledState(t *testing.T) {
	original := KeyValue{
		Key:     "Authorization",
		Value:   "Bearer <token>",
		Enabled: false,
	}

	data, err := json.Marshal(original)
	if err != nil {
		t.Fatalf("expected marshal to succeed, got %v", err)
	}

	if string(data) != `{"key":"Authorization","value":"Bearer \u003ctoken\u003e","enabled":false}` {
		t.Fatalf("expected enabled=false to be serialized, got %s", data)
	}

	var decoded KeyValue
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("expected unmarshal to succeed, got %v", err)
	}

	if decoded.Enabled {
		t.Fatal("expected enabled=false to survive round-trip")
	}
}

func TestKeyValueJSONDefaultsEnabledToTrueWhenOmitted(t *testing.T) {
	var decoded KeyValue
	if err := json.Unmarshal([]byte(`{"key":"X-Test","value":"1"}`), &decoded); err != nil {
		t.Fatalf("expected unmarshal to succeed, got %v", err)
	}

	if !decoded.Enabled {
		t.Fatal("expected missing enabled field to default to true")
	}
}

func TestNewRequestPODocFieldsRoundTrip(t *testing.T) {
	request := &Request{
		ID:            "req-1",
		CollectionID:  "col-1",
		Name:          "Create user",
		Method:        "POST",
		URL:           "https://example.com/users",
		DocMarkdown:   "# Create user",
		DocMarkdownZh: "# Create user zh",
		DocMarkdownEn: "# Create user",
		DocSource:     string(DocSourceAI),
	}

	po := newRequestPO(request)
	if po.DocMarkdown != request.DocMarkdown {
		t.Fatalf("expected doc_markdown to persist, got %q", po.DocMarkdown)
	}
	if po.DocMarkdownZh != request.DocMarkdownZh {
		t.Fatalf("expected doc_markdown_zh to persist, got %q", po.DocMarkdownZh)
	}
	if po.DocMarkdownEn != request.DocMarkdownEn {
		t.Fatalf("expected doc_markdown_en to persist, got %q", po.DocMarkdownEn)
	}
	if po.DocSource != request.DocSource {
		t.Fatalf("expected doc_source to persist, got %q", po.DocSource)
	}
}

func TestCleanGeneratedMarkdownStripsWholeDocumentFence(t *testing.T) {
	input := "```markdown\n## Health Check\n\nUse this endpoint.\n```"
	got := cleanGeneratedMarkdown(input)
	want := "## Health Check\n\nUse this endpoint."
	if got != want {
		t.Fatalf("expected fenced markdown to be stripped, got %q", got)
	}
}
