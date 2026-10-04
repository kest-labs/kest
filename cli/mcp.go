package main

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"os"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/kest-labs/kest/cli/internal/output"
	"github.com/modelcontextprotocol/go-sdk/mcp"
	"github.com/spf13/cobra"
)

const mcpInstructions = `Kest is an API verification tool. Use it to prove that HTTP APIs behave as expected after code changes.
- kest_request sends one HTTP request (optionally with assertions such as "status == 200" or "body.id exists").
- kest_run_flow runs Markdown flow files (*.flow.md) with multiple steps, captures and assertions.
- kest_replay re-sends a recorded request and can diff the response against the original.
- kest_snapshot_verify compares the latest recorded response for a path with its saved snapshot.
- kest_history lists recent recorded requests; kest_why asks the configured AI model to diagnose one.
Every tool returns one JSON document (schema_version 1): check "ok", then "steps[].error" and
"steps[].assertions" for failures, and "steps[].response.body" for evidence. Secrets are redacted.`

var mcpCmd = &cobra.Command{
	Use:   "mcp",
	Short: "Run Kest as a Model Context Protocol (MCP) server over stdio",
	Long: `Start an MCP server on stdin/stdout so AI coding agents (Claude Code, Cursor, ...)
can call Kest tools directly and read structured, redacted JSON results.

Tools: kest_request, kest_run_flow, kest_replay, kest_snapshot_verify, kest_history, kest_why.
Relative paths and the active Kest workspace are resolved from the server's working directory.`,
	Example: `  # Register with Claude Code
  claude mcp add kest -- kest mcp`,
	Args:         cobra.NoArgs,
	SilenceUsage: true,
	RunE: func(cmd *cobra.Command, args []string) error {
		// stdout is the protocol channel. Keep a handle on it for the
		// transport and send every stray fmt.Print in tool call paths to
		// the null device so it can never corrupt the JSON-RPC stream.
		protocolOut := os.Stdout
		restore := output.RedirectHumanOutput()
		defer restore()

		server := newMCPServer()
		return server.Run(cmd.Context(), &mcp.IOTransport{
			Reader: os.Stdin,
			Writer: nopWriteCloser{protocolOut},
		})
	},
}

func init() {
	rootCmd.AddCommand(mcpCmd)
}

type nopWriteCloser struct{ io.Writer }

func (nopWriteCloser) Close() error { return nil }

// mcpMu serializes tool calls: the run pipeline relies on package-level
// state (run flags, the active run context, stdout redirection).
var mcpMu sync.Mutex

// Tool inputs. Fields tagged omitempty are optional in the generated schema.

type mcpRunFlowInput struct {
	Path     string            `json:"path,omitempty" jsonschema:"flow file (.flow.md or .kest), directory or glob; defaults to the profile include patterns (all *.flow.md)"`
	Paths    []string          `json:"paths,omitempty" jsonschema:"additional flow files, directories or globs"`
	Env      string            `json:"env,omitempty" jsonschema:"Kest environment name to use for this run (e.g. local, staging)"`
	BaseURL  string            `json:"base_url,omitempty" jsonschema:"override the environment base URL, e.g. http://127.0.0.1:8080"`
	Vars     map[string]string `json:"vars,omitempty" jsonschema:"variables available as {{name}} in the flow"`
	Profile  string            `json:"profile,omitempty" jsonschema:"flow profile from .kest/flow.config.yaml"`
	FailFast bool              `json:"fail_fast,omitempty" jsonschema:"stop at the first failed step"`
}

type mcpRequestInput struct {
	Method     string            `json:"method" jsonschema:"HTTP method: GET, POST, PUT, PATCH or DELETE"`
	URL        string            `json:"url" jsonschema:"absolute URL or a path resolved against the environment base URL"`
	Headers    map[string]string `json:"headers,omitempty" jsonschema:"request headers"`
	Body       string            `json:"body,omitempty" jsonschema:"raw request body (JSON text for JSON APIs)"`
	Query      map[string]string `json:"query,omitempty" jsonschema:"query parameters"`
	Assertions []string          `json:"assertions,omitempty" jsonschema:"assertions such as 'status == 200' or 'body.data.id exists'"`
	Captures   []string          `json:"captures,omitempty" jsonschema:"captures such as 'token = data.token' stored for later {{token}} use"`
	Vars       map[string]string `json:"vars,omitempty" jsonschema:"variables available as {{name}} in the url, headers and body"`
	Env        string            `json:"env,omitempty" jsonschema:"Kest environment name to use"`
	TimeoutMs  int               `json:"timeout_ms,omitempty" jsonschema:"maximum response time in milliseconds"`
	NoRecord   bool              `json:"no_record,omitempty" jsonschema:"do not save the request to history"`
}

type mcpReplayInput struct {
	Record     string   `json:"record,omitempty" jsonschema:"record ID to replay, or 'last' (default)"`
	Diff       bool     `json:"diff,omitempty" jsonschema:"compare the new response with the recorded one"`
	Assertions []string `json:"assertions,omitempty" jsonschema:"assertions to evaluate against the new response"`
}

type mcpSnapshotInput struct {
	Path   string `json:"path" jsonschema:"request path whose latest recorded response is compared, e.g. /api/users"`
	Update bool   `json:"update,omitempty" jsonschema:"accept the current response as the new snapshot"`
}

type mcpHistoryInput struct {
	Limit  int    `json:"limit,omitempty" jsonschema:"maximum number of records (default 20)"`
	Status string `json:"status,omitempty" jsonschema:"status filter, e.g. 500 or 4xx"`
	Method string `json:"method,omitempty" jsonschema:"HTTP method filter"`
	URL    string `json:"url,omitempty" jsonschema:"URL substring filter"`
	Since  string `json:"since,omitempty" jsonschema:"only records newer than this duration, e.g. 1h or 30m"`
	Global bool   `json:"global,omitempty" jsonschema:"include records from every workspace"`
}

type mcpWhyInput struct {
	Record string `json:"record,omitempty" jsonschema:"record ID to diagnose, or 'last' (default)"`
}

// newMCPServer builds the Kest MCP server with all tools registered.
func newMCPServer() *mcp.Server {
	server := mcp.NewServer(&mcp.Implementation{Name: "kest", Title: "Kest API verification", Version: Version}, &mcp.ServerOptions{
		Instructions: mcpInstructions,
	})

	readOnly := &mcp.ToolAnnotations{ReadOnlyHint: true}

	mcp.AddTool(server, &mcp.Tool{
		Name:        "kest_run_flow",
		Title:       "Run Kest flow",
		Description: "Run one or more Kest flow files (*.flow.md) and return per-step status, assertions, captures and failing responses.",
	}, mcpHandler("run", mcpRunFlow))
	mcp.AddTool(server, &mcp.Tool{
		Name:        "kest_request",
		Title:       "Send HTTP request",
		Description: "Send one HTTP request through Kest (recorded to history), evaluate optional assertions and return the redacted response.",
	}, mcpHandler("request", mcpRequest))
	mcp.AddTool(server, &mcp.Tool{
		Name:        "kest_replay",
		Title:       "Replay recorded request",
		Description: "Re-send a recorded request ('last' or a record ID) and optionally diff the new response against the recorded one.",
	}, mcpHandler("replay", mcpReplay))
	mcp.AddTool(server, &mcp.Tool{
		Name:        "kest_snapshot_verify",
		Title:       "Verify response snapshot",
		Description: "Compare the latest recorded response for a path with its saved snapshot in .kest/snapshots (set update=true to accept changes).",
	}, mcpHandler("snap", mcpSnapshotVerify))
	mcp.AddTool(server, &mcp.Tool{
		Name:        "kest_history",
		Title:       "List request history",
		Description: "List recently recorded requests (id, method, redacted URL, status, duration). Use the id with kest_replay or kest_why.",
		Annotations: readOnly,
	}, mcpHandler("history", mcpHistory))
	mcp.AddTool(server, &mcp.Tool{
		Name:        "kest_why",
		Title:       "Diagnose recorded request",
		Description: "Ask the configured AI model to diagnose a recorded request. Requires 'kest config set ai_key'; otherwise returns an ai_not_configured error.",
		Annotations: readOnly,
	}, mcpHandler("why", mcpWhy))

	return server
}

// mcpHandler adapts a Kest operation to an MCP tool handler. It serializes
// calls, converts panics into error results, and always answers with the
// versioned JSON result as text content. Test failures are reported with
// ok=false but isError=false; isError is set only when the operation itself
// could not run (bad input, missing record, network setup errors, ...).
func mcpHandler[In any](command string, fn func(context.Context, In) (*output.Result, error)) mcp.ToolHandlerFor[In, any] {
	return func(ctx context.Context, _ *mcp.CallToolRequest, in In) (result *mcp.CallToolResult, _ any, _ error) {
		mcpMu.Lock()
		defer mcpMu.Unlock()

		defer func() {
			if recovered := recover(); recovered != nil {
				res := output.NewResult(command)
				res.SetError(output.ErrorKindInternal, fmt.Sprintf("internal error: %v", recovered))
				result = mcpToolResult(finalizeResult(command, res, nil))
			}
		}()

		res, err := fn(ctx, in)
		return mcpToolResult(finalizeResult(command, res, err)), nil, nil
	}
}

func mcpToolResult(res *output.Result) *mcp.CallToolResult {
	var buf bytes.Buffer
	if err := output.WriteJSON(&buf, res); err != nil {
		return &mcp.CallToolResult{
			Content: []mcp.Content{&mcp.TextContent{Text: "failed to encode result: " + err.Error()}},
			IsError: true,
		}
	}
	return &mcp.CallToolResult{
		Content: []mcp.Content{&mcp.TextContent{Text: buf.String()}},
		IsError: res.Error != nil,
	}
}

// withRunSettings applies run flags for one programmatic invocation and
// restores the previous values afterwards.
func withRunSettings(settings runSettings, fn func() (*output.Result, error)) (*output.Result, error) {
	previous := captureRunSettings()
	settings.apply()
	defer previous.apply()
	return fn()
}

func mcpRunFlow(_ context.Context, in mcpRunFlowInput) (*output.Result, error) {
	var targets []string
	if strings.TrimSpace(in.Path) != "" {
		targets = append(targets, strings.TrimSpace(in.Path))
	}
	for _, p := range in.Paths {
		if strings.TrimSpace(p) != "" {
			targets = append(targets, strings.TrimSpace(p))
		}
	}

	settings := defaultRunSettings()
	settings.env = strings.TrimSpace(in.Env)
	settings.baseURL = strings.TrimSpace(in.BaseURL)
	settings.profile = strings.TrimSpace(in.Profile)
	settings.failFast = in.FailFast
	settings.vars = varsToFlags(in.Vars)

	explicit := map[string]bool{
		"env":       settings.env != "",
		"base-url":  settings.baseURL != "",
		"fail-fast": in.FailFast,
		// Never push results to the web workspace from an agent session.
		"sync": true,
	}
	return withRunSettings(settings, func() (*output.Result, error) {
		return runSuite(targets, func(name string) bool { return explicit[name] })
	})
}

func mcpRequest(_ context.Context, in mcpRequestInput) (*output.Result, error) {
	method := strings.ToLower(strings.TrimSpace(in.Method))
	switch method {
	case "get", "post", "put", "patch", "delete", "head", "options":
	default:
		return nil, &ExitError{Code: ExitConfigError, Err: fmt.Errorf("unsupported HTTP method %q", in.Method)}
	}
	if strings.TrimSpace(in.URL) == "" {
		return nil, &ExitError{Code: ExitConfigError, Err: fmt.Errorf("url is required")}
	}

	settings := captureRunSettings()
	settings.env = strings.TrimSpace(in.Env)
	settings.baseURL = ""
	return withRunSettings(settings, func() (*output.Result, error) {
		ActiveRunCtx = NewRunContext(in.Vars)
		defer func() { ActiveRunCtx = nil }()

		headers := make([]string, 0, len(in.Headers))
		for _, key := range sortedKeys(in.Headers) {
			headers = append(headers, key+": "+in.Headers[key])
		}
		queries := make([]string, 0, len(in.Query))
		for _, key := range sortedKeys(in.Query) {
			queries = append(queries, key+"="+in.Query[key])
		}

		startedAt := time.Now()
		tr, err := ExecuteRequest(RequestOptions{
			Method:       method,
			URL:          strings.TrimSpace(in.URL),
			Data:         in.Body,
			Headers:      headers,
			Queries:      queries,
			Captures:     in.Captures,
			Asserts:      in.Assertions,
			NoRecord:     in.NoRecord,
			MaxDuration:  in.TimeoutMs,
			RetryWait:    1000,
			SilentOutput: true,
		})
		return buildRequestResult(tr, startedAt, time.Now()), err
	})
}

func mcpReplay(_ context.Context, in mcpReplayInput) (*output.Result, error) {
	return replayRecord(strings.TrimSpace(in.Record), in.Assertions, in.Diff)
}

func mcpSnapshotVerify(_ context.Context, in mcpSnapshotInput) (*output.Result, error) {
	if strings.TrimSpace(in.Path) == "" {
		return nil, &ExitError{Code: ExitConfigError, Err: fmt.Errorf("path is required")}
	}
	return snapshotPath(strings.TrimSpace(in.Path), true, in.Update)
}

func mcpHistory(_ context.Context, in mcpHistoryInput) (*output.Result, error) {
	return listHistory(in.Limit, in.Global, historyFilter{
		Status: in.Status,
		Method: in.Method,
		URL:    in.URL,
		Since:  in.Since,
	})
}

func mcpWhy(_ context.Context, in mcpWhyInput) (*output.Result, error) {
	return diagnoseRecord(strings.TrimSpace(in.Record))
}

func varsToFlags(vars map[string]string) []string {
	flags := make([]string, 0, len(vars))
	for _, key := range sortedKeys(vars) {
		flags = append(flags, key+"="+vars[key])
	}
	return flags
}

func sortedKeys(m map[string]string) []string {
	keys := make([]string, 0, len(m))
	for key := range m {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	return keys
}
