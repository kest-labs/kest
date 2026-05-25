package platformsync

import "testing"

func TestParseFlowSyncResponse(t *testing.T) {
	body := []byte(`{"code":0,"message":"success","data":{"created":1,"updated":2,"skipped":3}}`)
	resp, err := ParseFlowSyncResponse(body)
	if err != nil {
		t.Fatalf("ParseFlowSyncResponse returned error: %v", err)
	}
	if resp.Created != 1 || resp.Updated != 2 || resp.Skipped != 3 {
		t.Fatalf("unexpected response: %+v", resp)
	}
}

func TestBuildWorkspaceCLIEndpoint(t *testing.T) {
	got := buildWorkspaceCLIEndpoint("https://api.kest.dev/v1", "workspace-1", "flows/sync")
	want := "https://api.kest.dev/v1/workspaces/workspace-1/cli/flows/sync"
	if got != want {
		t.Fatalf("expected %q, got %q", want, got)
	}
}
