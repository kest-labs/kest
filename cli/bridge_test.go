package main

import "testing"

func TestNormalizeBridgeOrigins(t *testing.T) {
	origins := normalizeBridgeOrigins([]string{
		"",
		" http://localhost:3000 ",
		"http://localhost:3000",
		"http://localhost:3001",
	})

	if len(origins) != 2 {
		t.Fatalf("expected 2 origins, got %d: %#v", len(origins), origins)
	}

	if origins[0] != "http://localhost:3000" {
		t.Fatalf("expected first origin to be trimmed localhost:3000, got %q", origins[0])
	}

	if origins[1] != "http://localhost:3001" {
		t.Fatalf("expected second origin to be localhost:3001, got %q", origins[1])
	}
}

func TestBridgeOriginPolicyStrictRejectsUnknownOrigin(t *testing.T) {
	policy := newBridgeOriginPolicy("strict", []string{"http://localhost:3001"})

	if _, ok := policy.resolve("http://localhost:3001"); !ok {
		t.Fatalf("expected explicitly allowed origin to pass in strict mode")
	}

	if _, ok := policy.resolve("http://localhost:3000"); ok {
		t.Fatalf("expected unknown origin to be rejected in strict mode")
	}
}

func TestBridgeOriginPolicyAutoAllowsAndPersistsOrigin(t *testing.T) {
	policy := newBridgeOriginPolicy("auto", nil)

	origin, ok := policy.resolve("http://localhost:3003")
	if !ok {
		t.Fatalf("expected auto mode to allow new origin")
	}
	if origin != "http://localhost:3003" {
		t.Fatalf("expected resolved origin to be preserved, got %q", origin)
	}

	allowedOrigins := policy.listAllowedOrigins()
	if len(allowedOrigins) != 1 || allowedOrigins[0] != "http://localhost:3003" {
		t.Fatalf("expected auto mode to persist allowed origin, got %#v", allowedOrigins)
	}
}
