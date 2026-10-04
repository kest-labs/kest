# Machine-Readable Output (`--json`)

Kest can print a single, versioned JSON document instead of decorated terminal
output. This mode is meant for AI coding agents (Claude Code, Cursor, ...), CI
pipelines and scripts.

```bash
kest run login.flow.md --json
kest post /api/items -d '{"name":"x"}' -a "status==201" --json
kest replay last --diff --json
kest snap /api/users --verify --json
kest history -n 10 --json
```

`--json` is a shorthand for `--output json`; both work.

## Guarantees

- stdout contains **exactly one** JSON document followed by a newline.
- All human-oriented output (emoji, boxes, progress lines) is discarded in JSON
  mode. Warnings may still be written to **stderr** — read only stdout when
  parsing.
- Sensitive values are redacted with `[REDACTED]`: headers such as
  `Authorization`, `Cookie`, `Set-Cookie`, `X-Api-Key`; JSON body fields such as
  `password`, `token`, `access_token`, `secret`, `api_key`; and the same names
  in URL query strings. Bodies are truncated to 12,000 characters
  (`body_truncated: true`).
- The process exit code matches the `exit_code` field.

Supported commands: `run`, `get`, `post`, `put`, `patch`, `delete`, `replay`,
`snap`, `history`. Other commands ignore the flag and print normally.

## Schema (version 1)

```jsonc
{
  "schema_version": 1,          // bumped only on breaking changes
  "command": "run",             // run | request | replay | snap | history
  "ok": false,                  // true when every step passed and no error
  "exit_code": 1,               // same as the process exit code
  "summary": {
    "total": 2, "passed": 1, "failed": 1,
    "skipped": 0,               // steps skipped (a dependency failed) or never reached (--fail-fast)
    "duration_ms": 41           // wall-clock time of the command
  },
  "steps": [
    {
      "name": "Create item",
      "step_id": "create",                 // flow step @id (flows only)
      "phase": "step",                     // setup | step | teardown (flows only)
      "outcome": "failed",                 // passed | failed | skipped
      "source": "items.flow.md",          // flow file (run only)
      "method": "POST",
      "url": "http://127.0.0.1:8080/items",
      "status": 400,                       // 0 when no response was received
      "duration_ms": 3,
      "ok": false,
      "record_id": 42,                     // history record (kest show 42)
      "request_id": "req-123",             // from X-Request-ID or body
      "assertions": [
        { "expr": "status == 201", "ok": false,
          "message": "status mismatch\n  Expected: == 201\n  Actual:   400" },
        { "expr": "body.error exists", "ok": true },
        { "expr": "duration < 500", "ok": true, "soft": true }
      ],
      "captures": { "item_id": "17" },
      "request":  { "headers": {"Authorization": "[REDACTED]"}, "body": {"name": ""} },
      "response": { "headers": {"Content-Type": "application/json"},
                    "body": {"error": "name is required"} },
      "error": { "kind": "assertion", "message": "assertion failed: status == 201 (...)" }
    }
  ],
  "diff": {                       // replay --diff and snap --verify only
    "baseline": "record #41",     // or the snapshot file path
    "changed": true,
    "status_before": 200, "status_after": 500,
    "patch": "- \"ok\": true\n+ \"ok\": false\n"
  },
  "error": { "kind": "config", "message": "..." },  // command-level failure
  "data": { }                      // command-specific payload, see below
}
```

Notes:

- `outcome` is `passed`, `failed` or `skipped`; `ok` is true only for `passed`.
  A **skipped** step was not executed because a step it depends on (through a
  captured `{{variable}}` or an `@on success` edge) failed or was itself
  skipped. It carries `skipped_because` (the `step_id` of the root-cause
  failed step) and `skip_reason` instead of an `error`, is counted in
  `summary.skipped`, and never changes `ok` or `exit_code` on its own.
- `steps` and `assertions` are always arrays (possibly empty).
- `request` / `response` are always included for single requests
  (`get`/`post`/…, `replay`). For `run` they are included only for **failed**
  steps, to keep successful runs compact.
- JSON bodies are embedded as JSON values; other bodies as strings.
- `diff.patch` is a line diff of the redacted, pretty-printed bodies. Lines
  starting with `- ` were in the baseline, lines starting with `+ ` are new.
  `replay --diff` reports changes but does not fail on them; `snap --verify`
  fails with `snapshot_mismatch`.
- `history` puts records in `data.records`
  (`id`, `method`, `url`, `status`, `duration_ms`, `environment`,
  `created_at`, and `failure` when Kest marked the request failed) and never
  includes headers or bodies. `status` is `0` when no HTTP response was
  received (connection refused, DNS, TLS, timeout); `failure` holds the error.
- `snap` (save mode) returns `data.snapshot_path`.

### Error kinds

| `kind`              | Meaning                                              | Exit code |
| ------------------- | ---------------------------------------------------- | --------- |
| `assertion`         | An assertion did not hold                            | 1         |
| `snapshot_mismatch` | Response differs from the saved snapshot             | 1         |
| `network`           | Connection refused, DNS failure, TLS error, ...      | 2         |
| `timeout`           | Request/exec timed out or exceeded `--max-time`      | 2         |
| `exec`              | An `@type exec` step command failed                  | 2         |
| `teardown`          | A `teardown` step failed (`phase: "teardown"`)       | 2         |
| `interrupted`       | Run stopped by Ctrl-C (130) or SIGTERM (143)         | 130       |
| `internal`          | Unexpected failure inside Kest                       | 2         |
| `config`            | Bad flags, unreadable flow/data file, invalid step   | 3         |
| `variable`          | A required `{{variable}}` was not provided           | 3         |
| `not_found`         | No matching record or snapshot                       | 3         |
| `ai_not_configured` | AI-backed feature used without `ai_key`              | 3         |

## Exit codes

| Code | Meaning                                                       |
| ---- | ------------------------------------------------------------- |
| 0    | Success                                                       |
| 1    | Assertion or snapshot failure — the API did not behave as expected |
| 2    | Runtime error — network, timeout, exec failure                |
| 3    | Usage/config error — bad flags, missing file, missing variable |

When several steps fail, the exit code is derived from the **first** failure
(the root cause). For example, if an assertion fails and a later step then
reports a missing captured variable, the exit code is 1.

These exit codes apply in text mode as well.

## Parsing example

```bash
kest run tests/ --json > result.json
jq -r '.steps[] | select(.ok == false) | "\(.name): \(.error.kind) \(.error.message)"' result.json
```
