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

func TestParseRunnableFlowsResponse(t *testing.T) {
	body := []byte("{\"code\":0,\"message\":\"success\",\"data\":{\"items\":[{\"id\":\"flow-1\",\"source_id\":\"auth\",\"source_path\":\"flows/auth.flow.md\",\"definition\":\"```step\\nGET /health\\n```\",\"revision\":2}],\"total\":1}}")
	flows, err := ParseRunnableFlowsResponse(body)
	if err != nil {
		t.Fatalf("ParseRunnableFlowsResponse returned error: %v", err)
	}
	if len(flows) != 1 {
		t.Fatalf("expected 1 flow, got %d", len(flows))
	}
	if flows[0].SourceID != "auth" || flows[0].Revision != 2 {
		t.Fatalf("unexpected flow: %+v", flows[0])
	}
}

func TestBuildWorkspaceCLIEndpoint(t *testing.T) {
	got := buildWorkspaceCLIEndpoint("https://api.kest.dev/v1", "workspace-1", "flows/sync")
	want := "https://api.kest.dev/v1/workspaces/workspace-1/cli/flows/sync"
	if got != want {
		t.Fatalf("expected %q, got %q", want, got)
	}
}
