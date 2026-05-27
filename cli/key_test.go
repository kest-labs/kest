package main

import (
	"encoding/base64"
	"encoding/json"
	"testing"
)

func TestParseConnectionKey(t *testing.T) {
	autoSync := true
	payload := connectionKeyPayload{
		Version:                 1,
		PlatformURL:             "https://api.kest.dev/v1/",
		PlatformToken:           "kest_pat_example",
		PlatformWorkspaceID:     "12",
		PlatformAutoSyncHistory: &autoSync,
	}
	raw, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("marshal payload: %v", err)
	}
	key := connectionKeyPrefix + base64.RawURLEncoding.EncodeToString(raw)

	got, err := parseConnectionKey(key)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if got.PlatformURL != "https://api.kest.dev/v1" {
		t.Fatalf("expected normalized platform URL, got %q", got.PlatformURL)
	}
	if got.PlatformToken != payload.PlatformToken {
		t.Fatalf("expected token %q, got %q", payload.PlatformToken, got.PlatformToken)
	}
	if got.PlatformWorkspaceID != payload.PlatformWorkspaceID {
		t.Fatalf("expected workspace ID %q, got %q", payload.PlatformWorkspaceID, got.PlatformWorkspaceID)
	}
	if got.PlatformAutoSyncHistory == nil || !*got.PlatformAutoSyncHistory {
		t.Fatalf("expected auto history sync to be true, got %#v", got.PlatformAutoSyncHistory)
	}
}

func TestParseConnectionKeyRejectsRawToken(t *testing.T) {
	_, err := parseConnectionKey("kest_pat_example")
	if err == nil {
		t.Fatalf("expected error")
	}
}

func TestParseConnectionKeyRequiresFields(t *testing.T) {
	raw, err := json.Marshal(connectionKeyPayload{
		PlatformURL:       "https://api.kest.dev/v1",
		PlatformToken:     "kest_pat_example",
		PlatformWorkspaceID: "",
	})
	if err != nil {
		t.Fatalf("marshal payload: %v", err)
	}

	_, err = parseConnectionKey(connectionKeyPrefix + base64.RawURLEncoding.EncodeToString(raw))
	if err == nil {
		t.Fatalf("expected missing project id error")
	}
}
