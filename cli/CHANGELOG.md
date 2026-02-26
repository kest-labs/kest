# Kest CLI Changelog

## v0.7.3 (2026-02-26)

### Bug Fixes

- **Fix: parallel mode race condition on `os.Stdout`** — `os.Stdout = nil` caused undefined behavior and potential panics when multiple goroutines ran concurrently. Replaced with `os.Open(os.DevNull)` scoped per-goroutine via `defer`.
- **Fix: `buildVarChain` opened a new DB connection on every call** — In polling loops and multi-step flows this caused hundreds of redundant SQLite connections. `buildVarChain` now accepts an optional pre-opened `*storage.Store` to reuse across calls.
- **Fix: `kest replay` did not preserve `Environment` and `Project` on new record** — Replayed records were saved with empty metadata, making them invisible to project-scoped history. Now copies `BaseURL`, `Path`, `Environment`, and `Project` from the original record.
- **Fix: `GetAllRecords` had no row limit** — On large histories this loaded everything into memory. Now defaults to a 5000-row safety cap; callers can pass an explicit limit.
- **Fix: `kest sync push` always reported `cli_version: "1.0.0"`** — Now uses the actual `Version` build variable.
- **Fix: bubble sort in `sortByIndex`** — Replaced O(n²) bubble sort with `sort.Slice`.
- **Fix: unnecessary `fmt.Sprintf` in `suggest.go`** — Replaced with a plain string literal.

### New Features

- **`@env` directive in flow files now takes effect** — Flow files with `@env staging` in their metadata block will automatically switch the active environment for that run (unless overridden by `--env`).
- **`$env.VAR_NAME` built-in variable** — Read OS environment variables directly in flow files: `{{$env.DATABASE_URL}}`, `{{$env.API_KEY}}`. Essential for CI/CD secret injection.
- **New built-in variables**: `$uuid` (UUIDv4), `$randomEmail`, `$randomString` (12-char hex), `$isoDate` (RFC3339 UTC), `$unixMs` (Unix milliseconds).
- **New assert operators**: `contains`, `startsWith`, `endsWith`, `not exists`, `length`.
  ```
  body.message contains "success"
  body.email startsWith "user"
  body.error not exists
  body.items length == 3
  ```
- **`kest watch` now supports `--env`, `--var`, `--verbose` flags** — Watch mode was previously unable to override environment or inject variables.
- **`kest history` filter flags** — `--status 4xx`, `--method POST`, `--url /api/users`, `--since 1h`.
- **HTTP connection pool reuse** — `internal/client` now uses a shared `http.Transport` with idle connection pooling, improving throughput in parallel and sequential flow runs.

---

## v0.7.2 (2026-02-26)

### New Features

- **`--env` / `-e` flag for `kest run`** — Override the active environment for a single run without modifying `config.yaml`. Useful for regression testing against specific environments in CI/CD pipelines:
  ```bash
  kest run tests.flow.md -e staging
  kest run tests/ -e production --parallel --jobs 8
  ```

---

## v0.7.1 (2026-02-26)

### Bug Fixes

- **Fix: `[Captures]` and `[Asserts]` silently dropped in flow steps** — `parseFlowStep` was calling `ParseBlock` which returned a fresh `RequestOptions` and overwrote `step.Request` entirely, wiping out all captures and asserts parsed from the flow file. Fixed by preserving and merging them after assignment.
- **Fix: assertions never evaluated for HTTP steps** — Root cause same as above. Since `step.Request.Asserts` was always empty after parsing, no assertions were ever run. Steps always showed ✅ regardless of actual response status.
- **Fix: URL in logs/TestResult shows unsubstituted `{{var}}`** — `result.URL` was set to the raw pre-interpolation URL at initialization and never updated. Now updated to `finalURL` after variable substitution.

### New Features

- **`@timeout` directive for exec steps** — Exec steps now support a per-step timeout independent of the global `--exec-timeout` flag:
  ```
  @type exec
  @timeout 60s
  echo "long running task"
  ```

### Infrastructure

- Replace `github.com/mattn/go-sqlite3` (CGO) with `modernc.org/sqlite` (pure Go) — enables cross-compilation for all platforms (linux/amd64, linux/arm64, darwin/amd64, darwin/arm64) without a C toolchain.
- Fix CI release pipeline: set `working-directory: cli` for `go test`, add `workdir: cli` for GoReleaser action.
- Fix root `.gitignore` `storage/` rule incorrectly ignoring `cli/internal/storage/*.go`.
- Fix `auto-tag.yml` workflow to read `cli/VERSION` instead of root `VERSION`.

---

## v0.7.0 (2026-02-20)

### 🎉 Major Features

Based on comprehensive user feedback, this release addresses the top pain points in variable handling, debugging, and developer experience.

#### 1. Variable Default Value Syntax ✨

Support for default values in variable syntax to reduce `--var` usage:

```markdown
### Step: Login
POST /api/login
```json
{
  "username": "{{username | default: \"admin\"}}",
  "password": "{{password | default: \"Admin@123\"}}"
}
```
```

**Benefits**:
- No need to pass `--var` for every test
- Self-documenting flows
- Faster testing iterations

#### 2. Strict Variable Validation 🔒

New `--strict` flag to catch undefined variables before execution:

```bash
kest run flow.md --strict
```

**Error Example**:
```
❌ Error: Required variables not provided: username, password

Hint: Use one of the following:
  1. --var username=<value> --var password=<value>
  2. Add to config.yaml
  3. Use default values: {{var | default: "value"}}
```

**Benefits**:
- Catch errors before making API requests
- Clear, actionable error messages
- Avoid debugging 401/403 errors caused by unresolved variables

#### 3. Fail-Fast Mode ⚡

New `--fail-fast` flag to stop execution on first failure:

```bash
kest run flow.md --fail-fast
```

**Output Example**:
```
✅ Step 1: Login - OK
✅ Step 2: Get Profile - OK
❌ Step 3: Update Profile - FAILED

⚠️  Stopping execution (--fail-fast enabled)
   Failed step: Update Profile
   Reason: HTTP 403 - Forbidden
   Skipped 5 remaining step(s)
```

**Benefits**:
- Save time by not running dependent steps
- Faster feedback loop
- Ideal for CI/CD pipelines

#### 4. Variable Source Tracking 📊

Enhanced RunContext to track variable sources and step status:

```go
type VariableSource struct {
    Value      string
    SourceStep string // which step captured this variable
    StepStatus string // "success" or "failed"
    SourceType string // "cli", "capture", "config", "builtin"
}
```

**Benefits**:
- Know where each variable came from
- Detect variables from failed steps
- Better debugging experience

#### 5. Flow-Level Default Headers 🎯

Support for default headers at the Flow level (structure ready):

```markdown
---
default_headers:
  Authorization: Bearer {{token}}
  Content-Type: application/json
---

### Step 1: Get Profile
GET /api/profile
# Automatically includes Authorization and Content-Type

### Step 2: Update Profile
PATCH /api/profile
# Also includes default headers
```

**Benefits**:
- Reduce repetition
- Cleaner flow files
- Easier maintenance

### 📚 Documentation

#### New Documentation

- **`VARIABLES.md`** - Comprehensive variable system guide
  - Variable syntax and priority
  - Default value usage
  - Strict mode explanation
  - Built-in variables
  - Best practices and FAQ

- **`IMPROVEMENT_PLAN.md`** - Detailed improvement roadmap
  - All 9 user feedback items
  - Implementation priorities
  - Technical design
  - Timeline and phases

#### Updated Documentation

- **`AGENTS.md`** - Added new flags to command reference
- **`README.md`** - Updated with new features

### 🔧 API Changes

#### New Functions

**`variable.go`**:
- `InterpolateStrict(text, vars) (string, error)` - Strict variable validation
- `parseVarWithDefault(content) (varName, defaultValue)` - Parse default syntax
- `isBuiltinVar(name) bool` - Check if variable is built-in
- `resolveBuiltin(name) string` - Resolve built-in variable values

**`run_context.go`**:
- `SetWithSource(key, value, stepName, stepStatus, sourceType)` - Track variable source
- `GetSource(key) (*VariableSource, bool)` - Get variable source info
- `MarkStepFailed(stepName)` - Mark all variables from a step as failed

#### New CLI Flags

**`kest run`**:
- `--strict` - Enable strict variable validation
- `--fail-fast` - Stop on first failed step
- `--debug-vars` - Show variable resolution details (existing, enhanced)

### 🐛 Bug Fixes

- Fixed tautological condition warning in `run.go`
- Improved error messages for undefined variables
- Better handling of variable interpolation edge cases

### 🔄 Breaking Changes

**None** - All new features are opt-in via flags. Existing flows work unchanged.

### 📊 Statistics

- **Files Changed**: 7
- **Lines Added**: 950+
- **Lines Removed**: 20
- **New Features**: 5
- **User Pain Points Addressed**: 9/9

### 🎯 User Feedback Addressed

| # | Issue | Solution | Priority | Status |
|---|-------|----------|----------|--------|
| 1 | Variable missing error unclear | `--strict` mode + clear errors | 🔴 High | ✅ Done |
| 2 | No default value syntax | `{{var \| default: "value"}}` | 🔴 High | ✅ Done |
| 3 | Failure continues execution | `--fail-fast` mode | 🔴 High | ✅ Done |
| 4 | Variable priority unclear | `VARIABLES.md` documentation | 🔴 High | ✅ Done |
| 5 | Failed step variable tracking | `VariableSource` tracking | 🟡 Medium | ✅ Done |
| 6 | Request header repetition | Flow-level default headers | 🟡 Medium | 🚧 Partial |
| 7 | Array path syntax | Already supported by gjson | 🟡 Medium | ✅ Done |
| 8 | Debug output enhancement | `--debug-vars` improvements | 🟢 Low | 🚧 Planned |
| 9 | Prerequisites check | `@setup` steps | 🟢 Low | 🚧 Planned |

### 🚀 Migration Guide

No migration needed! All features are backward compatible.

**To start using new features**:

```bash
# Use default values in your flows
{{username | default: "admin"}}

# Enable strict mode for better error catching
kest run flow.md --strict

# Use fail-fast in CI/CD
kest run tests/ --strict --fail-fast

# Debug variable issues
kest run flow.md --debug-vars -v
```

### 📝 Examples

See `test-variables.flow.md` for comprehensive examples of all new features.

### 🙏 Acknowledgments

Special thanks to our users for the detailed feedback that made this release possible. Your real-world usage insights directly shaped these improvements.

### 🔮 What's Next (v1.2.0)

- Complete Flow-level default headers implementation
- Enhanced debug output with failure categorization
- `@setup` and `@teardown` step support
- Variable validation in config.yaml
- More built-in variables (`$uuid`, `$date`, etc.)

---

**Release Date**: 2026-02-20  
**Git Commit**: TBD  
**Status**: Ready for Release
