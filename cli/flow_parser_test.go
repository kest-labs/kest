package main

import "testing"

// A bare ``` fence has no info string; it used to panic the parser.
func TestParseFlowMarkdownBareFence(t *testing.T) {
	content := "# Doc\n\n```\nplain text\n```\n\n```step\n@id a\nGET /health\n```\n"
	blocks := ParseFlowMarkdown(content)
	if len(blocks) != 1 || blocks[0].Kind != "step" {
		t.Fatalf("expected only the step block, got %+v", blocks)
	}
}
