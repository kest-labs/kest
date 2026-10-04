# Kest MCP Server

`kest mcp` runs Kest as a [Model Context Protocol](https://modelcontextprotocol.io)
server over stdio. AI coding agents such as Claude Code and Cursor can then call
Kest directly, read structured results, and fix code based on real API
behavior instead of guessing from curl output.

```bash
kest mcp
```

The server speaks JSON-RPC 2.0 (newline-delimited) on stdin/stdout. Nothing else
is ever written to stdout; human-oriented output from the request/flow engine is
discarded and warnings go to stderr.

## Setup

### Claude Code

```bash
claude mcp add kest -- kest mcp
```

To share the server with your team, commit a `.mcp.json` file at the
repository root instead:

```json
{
  "mcpServers": {
    "kest": {
      "command": "kest",
      "args": ["mcp"]
    }
  }
}
```

### Cursor

Add the server to `.cursor/mcp.json` in the repository (or `~/.cursor/mcp.json`
to enable it everywhere):

```json
{
  "mcpServers": {
    "kest": {
      "command": "kest",
      "args": ["mcp"],
      "env": {
        "KEST_ENV": "local"
      }
    }
  }
}
```

### Working directory and environment

Relative flow paths, `.kest/config.yaml`, `.kest/flow.config.yaml` and
`.kest/snapshots/` are resolved from the server's working directory, which is
normally the repository the agent was started in. Set `KEST_WORKSPACE_ROOT` to
point at a different Kest workspace, and `KEST_ENV` / `KEST_BASE_URL` to select
the environment, exactly as for the CLI.

## Tools

Every tool returns a single text content item containing the same versioned
JSON document as `kest ... --json` (see [json-output.md](json-output.md)).

| Tool                   | Arguments                                                                                                 | CLI equivalent                 |
| ---------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------ |
| `kest_request`         | `method`, `url`, `headers`, `body`, `query`, `assertions`, `captures`, `vars`, `env`, `timeout_ms`, `no_record` | `kest get/post/... --json`     |
| `kest_run_flow`        | `path`, `paths`, `env`, `base_url`, `vars`, `profile`, `fail_fast`                                        | `kest run <path> --json`       |
| `kest_replay`          | `record` (`"last"` or an id), `diff`, `assertions`                                                        | `kest replay last --diff --json` |
| `kest_snapshot_verify` | `path`, `update`                                                                                          | `kest snap <path> --verify --json` |
| `kest_history`         | `limit`, `status`, `method`, `url`, `since`, `global`                                                     | `kest history --json`          |
| `kest_why`             | `record` (`"last"` or an id)                                                                              | `kest why --json`              |

Notes:

- `kest_run_flow` with no `path` runs the profile's include patterns (all
  `*.flow.md` files by default). It never syncs results to the Kest web
  workspace, even when the selected profile enables `sync`.
- `kest_request` records the request to local history (unless `no_record` is
  set), so `kest_replay` / `kest_why` can refer to it afterwards.
- `kest_why` requires an AI key (`kest config set ai_key <key>`). Without it the
  tool returns an error result with `error.kind = "ai_not_configured"`.
- Tool calls are executed one at a time.

### Errors

- A failing assertion or step is **not** a tool error: the call succeeds with
  `ok: false`, `exit_code: 1` and details in `steps[].assertions` /
  `steps[].error`.
- When the operation itself cannot run (unknown flow file, missing record or
  snapshot, invalid method, AI not configured) the result has a top-level
  `error` and the MCP response sets `isError: true`.
- Internal panics are caught and reported as `error.kind = "internal"`; the
  server keeps running.

## Example session

A typical agent loop after changing an endpoint:

1. `kest_request` → `{"method": "POST", "url": "/api/items", "body": "{\"name\":\"x\"}", "assertions": ["status == 201", "body.id exists"]}`
2. If `ok` is false, read `steps[0].response.body` and `steps[0].assertions`, fix the code, and call `kest_replay` with `{"record": "last", "assertions": ["status == 201"]}`.
3. Before finishing, run the regression suite with `kest_run_flow` → `{"path": "tests/"}`.

## Debugging

```bash
# Inspect the server with the official MCP inspector
npx @modelcontextprotocol/inspector kest mcp
```
