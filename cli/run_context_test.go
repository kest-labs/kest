package main

import "testing"

func TestResolveExecCaptureLineAliases(t *testing.T) {
	output := "first\nsecond\nthird"

	tests := map[string]string{
		"$line.0": "first",
		"$line.1": "first",
		"line.2":  "second",
	}

	for query, expected := range tests {
		if got := ResolveExecCapture(output, query); got != expected {
			t.Fatalf("ResolveExecCapture(%q) = %q, want %q", query, got, expected)
		}
	}
}

func TestResolveExecCaptureJSONPath(t *testing.T) {
	output := `{"signature":"abc","items":[{"id":"one"}]}`

	if got := ResolveExecCapture(output, "signature"); got != "abc" {
		t.Fatalf("expected JSON capture signature=abc, got %q", got)
	}
	if got := ResolveExecCapture(output, "items[0].id"); got != "one" {
		t.Fatalf("expected JSON array capture items[0].id=one, got %q", got)
	}
}
