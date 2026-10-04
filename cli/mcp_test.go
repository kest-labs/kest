package main

import (
	"context"
	"encoding/json"
	"io"
	"sort"
	"strings"
	"testing"
	"time"

	"github.com/kest-labs/kest/cli/internal/output"
	"github.com/modelcontextprotocol/go-sdk/mcp"
)

// connectMCP starts the Kest MCP server and a client over a pair of
// in-memory pipes and returns the initialized client session.
func connectMCP(t *testing.T) *mcp.ClientSession {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	t.Cleanup(cancel)

	serverReader, clientWriter := io.Pipe()
	clientReader, serverWriter := io.Pipe()

	server := newMCPServer()
	serverDone := make(chan error, 1)
	go func() {
		serverDone <- server.Run(ctx, &mcp.IOTransport{Reader: serverReader, Writer: serverWriter})
	}()

	client := mcp.NewClient(&mcp.Implementation{Name: "kest-test", Version: "0"}, nil)
	session, err := client.Connect(ctx, &mcp.IOTransport{Reader: clientReader, Writer: clientWriter}, nil)
	if err != nil {
		t.Fatalf("initialize: %v", err)
	}
	t.Cleanup(func() {
		_ = session.Close()
		_ = clientWriter.Close()
		select {
		case <-serverDone:
		case <-time.After(5 * time.Second):
			t.Error("MCP server did not stop after the client disconnected")
		}
	})
	return session
}

func callTool(t *testing.T, session *mcp.ClientSession, name string, args map[string]any) (*mcp.CallToolResult, output.Result) {
	t.Helper()
	res, err := session.CallTool(context.Background(), &mcp.CallToolParams{Name: name, Arguments: args})
	if err != nil {
		t.Fatalf("tools/call %s: %v", name, err)
	}
	if len(res.Content) != 1 {
		t.Fatalf("%s: expected one content item, got %d", name, len(res.Content))
	}
	text, ok := res.Content[0].(*mcp.TextContent)
	if !ok {
		t.Fatalf("%s: expected text content, got %T", name, res.Content[0])
	}
	var result output.Result
	if err := json.Unmarshal([]byte(text.Text), &result); err != nil {
		t.Fatalf("%s: content is not a JSON result: %v\n%s", name, err, text.Text)
	}
	if result.SchemaVersion != output.SchemaVersion {
		t.Fatalf("%s: unexpected schema version %d", name, result.SchemaVersion)
	}
	return res, result
}

func TestMCPServerToolsOverPipes(t *testing.T) {
	work := isolateKest(t)
	api := newAPIServer(t)
	writeFlow(t, work, "health.flow.md", passingFlow)
	writeFlow(t, work, "items.flow.md", failingFlow)

	session := connectMCP(t)

	if got := session.InitializeResult().ServerInfo.Name; got != "kest" {
		t.Fatalf("unexpected server name %q", got)
	}

	tools, err := session.ListTools(context.Background(), nil)
	if err != nil {
		t.Fatalf("tools/list: %v", err)
	}
	var names []string
	for _, tool := range tools.Tools {
		names = append(names, tool.Name)
	}
	sort.Strings(names)
	want := []string{"kest_history", "kest_replay", "kest_request", "kest_run_flow", "kest_snapshot_verify", "kest_why"}
	if strings.Join(names, ",") != strings.Join(want, ",") {
		t.Fatalf("unexpected tools: %v", names)
	}

	t.Run("request passes", func(t *testing.T) {
		raw, res := callTool(t, session, "kest_request", map[string]any{
			"method":     "GET",
			"url":        api.URL + "/health",
			"headers":    map[string]any{"Authorization": "Bearer top-secret"},
			"assertions": []any{"status == 200", "body.ok == true"},
		})
		if raw.IsError || !res.OK || len(res.Steps) != 1 || res.Steps[0].Status != 200 {
			t.Fatalf("unexpected result: isError=%v %+v", raw.IsError, res)
		}
		if res.Steps[0].Request.Headers["Authorization"] != "[REDACTED]" {
			t.Fatalf("authorization header not redacted: %+v", res.Steps[0].Request.Headers)
		}
		if res.Steps[0].RecordID == 0 {
			t.Fatalf("expected the request to be recorded")
		}
	})

	t.Run("request assertion failure is a result, not a tool error", func(t *testing.T) {
		raw, res := callTool(t, session, "kest_request", map[string]any{
			"method":     "POST",
			"url":        api.URL + "/items",
			"body":       `{"name":""}`,
			"assertions": []any{"status == 201"},
		})
		if raw.IsError || res.OK || res.ExitCode != ExitAssertionFailed {
			t.Fatalf("expected assertion failure result, got isError=%v %+v", raw.IsError, res)
		}
		if res.Steps[0].Error == nil || res.Steps[0].Error.Kind != output.ErrorKindAssertion {
			t.Fatalf("expected assertion error kind, got %+v", res.Steps[0].Error)
		}
	})

	t.Run("run flow", func(t *testing.T) {
		_, res := callTool(t, session, "kest_run_flow", map[string]any{
			"path":     "health.flow.md",
			"base_url": api.URL,
		})
		if !res.OK || res.Summary.Passed != 1 || res.Steps[0].Captures["version"] != "1.2.3" {
			t.Fatalf("unexpected run result: %+v", res)
		}

		_, res = callTool(t, session, "kest_run_flow", map[string]any{
			"path":     "items.flow.md",
			"base_url": api.URL,
		})
		if res.OK || res.Summary.Failed != 1 || res.ExitCode != ExitAssertionFailed {
			t.Fatalf("unexpected failing run result: %+v", res)
		}
	})

	t.Run("run flow with missing file reports config error", func(t *testing.T) {
		raw, res := callTool(t, session, "kest_run_flow", map[string]any{"path": "nope.flow.md"})
		if !raw.IsError || res.ExitCode != ExitConfigError || res.Error == nil || res.Error.Kind != output.ErrorKindConfig {
			t.Fatalf("expected config error, got isError=%v %+v", raw.IsError, res)
		}
	})

	t.Run("replay last with diff", func(t *testing.T) {
		_, res := callTool(t, session, "kest_replay", map[string]any{"record": "last", "diff": true})
		if !res.OK || res.Diff == nil || res.Diff.Baseline == "" {
			t.Fatalf("unexpected replay result: %+v", res)
		}
	})

	t.Run("history is redacted and listed", func(t *testing.T) {
		_, res := callTool(t, session, "kest_history", map[string]any{"limit": 5})
		data, ok := res.Data.(map[string]any)
		if !ok || !res.OK {
			t.Fatalf("unexpected history result: %+v", res)
		}
		records, _ := data["records"].([]any)
		if len(records) == 0 {
			t.Fatalf("expected history records, got %+v", data)
		}
	})

	t.Run("snapshot verify without snapshot", func(t *testing.T) {
		raw, res := callTool(t, session, "kest_snapshot_verify", map[string]any{"path": "/health"})
		if !raw.IsError || res.Error == nil || res.Error.Kind != output.ErrorKindNotFound {
			t.Fatalf("expected not_found error, got %+v", res)
		}
	})

	t.Run("why without AI config", func(t *testing.T) {
		raw, res := callTool(t, session, "kest_why", map[string]any{})
		if !raw.IsError || res.Error == nil || res.Error.Kind != output.ErrorKindAINotConfigured {
			t.Fatalf("expected ai_not_configured error, got %+v", res)
		}
	})

	t.Run("invalid input does not crash the server", func(t *testing.T) {
		raw, res := callTool(t, session, "kest_request", map[string]any{"method": "BREW", "url": "/coffee"})
		if !raw.IsError || res.Error == nil {
			t.Fatalf("expected tool error, got %+v", res)
		}
		// The server must still answer afterwards.
		if _, err := session.ListTools(context.Background(), nil); err != nil {
			t.Fatalf("server stopped responding: %v", err)
		}
	})
}

func TestMCPHandlerRecoversFromPanic(t *testing.T) {
	handler := mcpHandler("run", func(context.Context, struct{}) (*output.Result, error) {
		panic("boom")
	})
	res, _, err := handler(context.Background(), nil, struct{}{})
	if err != nil || res == nil || !res.IsError {
		t.Fatalf("expected an error result, got res=%+v err=%v", res, err)
	}
	text := res.Content[0].(*mcp.TextContent).Text
	if !strings.Contains(text, "boom") || !strings.Contains(text, `"kind": "internal"`) {
		t.Fatalf("unexpected panic result: %s", text)
	}
}
