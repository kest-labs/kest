# Kest Flow (.flow.md) User Guide 🌊

Kest Flow is one of the core features of Kest CLI, designed to achieve "Documentation as Code" through Markdown documents. Each `.flow.md` file represents a complete **test flow scenario**.

## 🌟 Core Philosophy

- **Flow-based Testing**: Chain multiple related API calls together to form a complete business flow (e.g., Register → Login → Create Project → Query Details).
- **Variable Passing**: Automatically extract data from previous responses (like Token, ID) and pass them to subsequent requests.
- **Documentation as Code**: Your API documentation itself is executable test cases.

---

## 🎯 Best Practices

### Use Relative URLs, Not Full URLs

**❌ Don't hardcode base URLs in flow files:**
```kest
# Bad - hardcoded base URL
POST https://api.example.com/v1/auth/login
```

**✅ Use relative URLs and configure base URL:**
```kest
# Good - relative URL
POST /api/v1/auth/login
```

**Why?**
- Flow files become environment-agnostic
- Easy to switch between dev/staging/production
- No need to edit flow files when URLs change

**How to configure base URL:**

1. **Initialize project:**
```bash
kest init
```

2. **Edit `.kest/config.yaml`:**
```yaml
project_id: my-project
active_env: dev

environments:
  - name: dev
    base_url: https://api.dev.example.com
  - name: staging
    base_url: https://api.staging.example.com
  - name: production
    base_url: https://api.example.com
```

3. **Switch environments:**
```bash
kest env use staging
kest run login.flow.md  # Uses staging base URL
```

---

## 📝 Writing Flow Files

Create a file with the `.flow.md` extension and use code blocks to define each step.

### Supported Code Block Types

Kest supports the following code block markers (choose your preferred syntax highlighting):
- ` ```kest ` - Standard Kest syntax (legacy)
- ` ```http ` - HTTP syntax highlighting (legacy)
- ` ```json ` - JSON syntax highlighting (legacy)
- ` ```flow ` - Flow metadata block (new)
- ` ```step ` - Step block (new)
- ` ```edge ` - Edge block (new)

Both backticks and tildes are supported: ` ``` ` and ` ~~~ `.

---

## 🧭 Flow Blocks (Recommended)

Flow blocks are Markdown-native and map 1:1 to a flow graph.

### 1) Flow Metadata Block
```flow
@flow id=user-onboarding
@name User Onboarding
@version 1.0
@tags auth, user
@env dev
```

### 2) HTTP Step Block
```step
@id login
@name Login
@retry 2
@max-duration 1000

POST /api/v1/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "password123"
}

[Captures]
token = data.access_token
user_id = data.user.id

[Asserts]
status == 200
body.data.access_token exists
duration < 500
```

### 3) Exec Step Block

Exec steps run shell commands and capture output as variables. This is essential for dynamic computations like HMAC signing, token generation, or any pre-processing that can't be expressed as a simple HTTP request.

```step
@id generate-signature
@name Generate HMAC Signature
@type exec

echo -n "{{timestamp}}:{{api_key}}" | openssl dgst -sha256 -hmac "{{api_key}}" | awk '{print $NF}'

[Captures]
signature = $line.0
```

**Exec Capture Modes:**

| Query | Description | Example |
| :--- | :--- | :--- |
| `$stdout` | Entire stdout output | `output = $stdout` |
| `$line.N` | Nth line (0-indexed) | `first = $line.0` |
| `<gjson path>` | Parse stdout as JSON | `token = data.token` |

**JSON output example:**
```step
@id generate-vars
@name Generate Dynamic Vars
@type exec

echo '{"ts":"'$(date +%s)'","nonce":"'$RANDOM'"}'

[Captures]
timestamp = ts
nonce = nonce
```

**Notes:**
- Exec steps use `sh -c` on Unix and `cmd /C` on Windows.
- Default timeout is 30 seconds. Override with `--exec-timeout`.
- The full variable chain is available for interpolation in the command.
- Captured values are stored in the run context and available to all subsequent steps.

### 4) Edge Block (Flow Graph)
```edge
@from login
@to profile
@on success
```

### Failed and skipped steps

When a step fails, steps that need something it was supposed to produce are
**skipped**, not failed. A step is skipped when it uses a `{{variable}}` that a
failed (or already skipped) step was supposed to capture, or when it has an
incoming `@on success` edge from a failed or skipped step. Skipped steps are
not executed, are not counted as failures and never change the exit code on
their own; the exit code is driven by the real failures. Steps that do not
depend on the failed step still run (unless `--fail-fast` is set).

```
✗ 1 failed, 4 skipped (caused by Create item (4))
  Root cause: Create item - assertion failed: status == 201 ...
```

A variable passed with `--var` or defined in the active environment is never
considered missing, so it does not cause a skip. The same information is in
`--json` (`outcome: "skipped"`, `skipped_because`, `skip_reason` on each step,
`summary.skipped`), JUnit (`<skipped/>`), the HTML report and `--report-json`.

### Teardown is a `finally` block

`teardown` steps always run after setup and the main steps finish: after
failures, with `--fail-fast`, and after Ctrl-C / SIGTERM (the in-flight request
is cancelled, teardown gets up to 10 seconds, then Kest exits with 130 / 143; a
second Ctrl-C quits immediately). Each flow file runs its own teardown, also in
directory runs.

- Teardown steps run in declared order. Kest does not reverse them: if you
  create A then B, write the teardown that deletes B before the one that
  deletes A.
- A teardown step that needs a variable the run never captured (the creating
  step failed, was skipped or was not reached) is **skipped** with the reason,
  never run against a stale value from an earlier run.
- A failing teardown step is reported with phase `teardown` and error kind
  `teardown` (exit code 2 when nothing else failed). It never hides the
  original failure: the exit code still comes from the first failed step, and
  the remaining teardown steps still run.

```teardown
@id cleanup
@name Delete order
DELETE /orders/{{order_id}}
```

You no longer need a trailing DELETE step at the end of the main steps.

### Mermaid Preview (in `-v` mode)
Kest prints a Mermaid flowchart for the parsed Flow document when you run with `-v`:
```bash
kest run user.flow.md -v
```

---

## 📘 Legacy Kest Blocks (Still Supported)

Legacy blocks are kept for compatibility.
### Complete Syntax Specification

```kest
# 1. First line: METHOD URL
POST /api/v1/auth/login

# 2. Request Headers (Optional)
Content-Type: application/json
Authorization: Bearer {{token}}

# 3. Request Body (Leave an empty line after headers)
{
  "username": "admin",
  "password": "password123"
}

# 4. Variable Capture (Core Feature)
[Captures]
token = data.access_token
user_id = data.user.id

# 5. Logical Assertions
[Asserts]
status == 200
body.data.access_token exists
duration < 500
```

### 📋 Query Parameters

You can add them directly in the URL or use the `[Queries]` block:

```kest
GET /api/v1/search

[Queries]
q = kest
page = 1
limit = 20
```


---

## 🔗 Variable System

### Variable Capture

Use `[Captures]` to extract data from responses and save as variables:

```kest
POST /api/v1/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "password123"
}

[Captures]
token = data.access_token
user_id = data.user.id
expires_at = data.expires_at
```

**Syntax Explanation**:
- Use `variable_name = JSONPath` format
- JSONPath extracts data from response body
- Variables are saved to local database (project + environment isolation)

### Variable Usage

Reference variables in subsequent requests using `{{variable_name}}`:

```kest
GET /api/v1/users/{{user_id}}/profile
Authorization: Bearer {{token}}

[Asserts]
status == 200
```

**Available Locations**:
- URL: `/users/{{user_id}}`
- Header: `Authorization: Bearer {{token}}`
- Body: `{"userId": "{{user_id}}"}`
- Query: `?id={{user_id}}`

### Built-in Dynamic Variables

Kest provides built-in variables for generating dynamic data:

```kest
POST /api/v1/test
Content-Type: application/json

{
  "requestId": "req-{{$randomInt}}",
  "timestamp": {{$timestamp}}
}
```

**Available Built-in Variables**:
- `{{$randomInt}}` - Random integer (0-10000)
- `{{$timestamp}}` - Current Unix timestamp

### Variable Priority

When variables with the same name come from multiple sources, the priority is (highest wins):

1. **Run Context** - `--var` flags and `@type exec` captures (Highest Priority)
2. **Runtime Capture** - Variables captured via `[Captures]` in HTTP steps (stored in DB)
3. **Config File** - Static variables defined in `.kest/config.yaml`
4. **Built-in Variables** - `$randomInt`, `$timestamp` (evaluated at interpolation time)

### Variable Scope

Variable scope is: **Current Project + Current Environment**

```bash
# After switching environments, variables are isolated
kest env use dev
kest run login.flow.md    # Captured token saved in dev environment

kest env use staging
kest run login.flow.md    # Captured token saved in staging environment
```

---

## 🚀 Execution Commands

You can execute the entire test flow with a simple command:

```bash
# Execute a single flow
kest run user_auth.flow.md

# Inject variables from CLI
kest run user_auth.flow.md --var api_key=secret --var env=prod

# Parallel execution (if you have multiple flows)
kest run tests/ --parallel --jobs 4

# Set exec step timeout (default: 30s)
kest run hmac.flow.md --exec-timeout 10
```

### Selecting flows and steps

```bash
# Only flow files whose @tags include any of these (directories / many targets)
kest run tests/ --tag smoke,auth

# See step ids, line numbers, captures and variables without executing anything
kest run checkout.flow.md --list            # add --json for machines

# Run part of ONE file
kest run checkout.flow.md --only pay,confirm
kest run checkout.flow.md --from pay
kest run checkout.flow.md --skip send-email
```

- `--tag` matches `@tags` case-insensitively. If nothing matches (also for a
  single file) the run stops with a usage error listing the tags in use.
- `--only`, `--from` and `--skip` take step ids (`@id`, or the step name) and
  need exactly one flow file. An unknown id fails before anything runs and
  lists close matches. They combine: `--from` then `--only` narrows, `--skip`
  removes.
- By default a partial run still runs the `setup` block, the `teardown` block
  and, transitively, the earlier steps that **capture** variables the selected
  steps use (marked `dependency` in `--list`). `--no-deps` runs exactly the
  selected steps instead (no setup, no teardown); it stops with a usage error
  if a selected step needs a `{{variable}}` that nothing provides, so pass it
  with `--var name=value` or a value saved by a previous run.
- A step excluded with `--skip` is reported as skipped (`skipped by --skip`);
  steps that need its captures are skipped too. This never fails the run.
- `--list` honors `--tag`, `--only`, `--from`, `--skip` and `--no-deps`; with
  `--json` the plan is in `data.flows[].steps[]` (`id`, `phase`, `line`,
  `method`, `url`, `captures`, `needs`, `selection`).

---

## 🛠 Advanced Tips

### 1. Environment Switching
Use with `kest env` to seamlessly run the same flow across dev, test, and production environments:
```bash
kest env use staging
kest run user_auth.flow.md
```

### 2. Retry Mechanism
Add retry logic for unstable endpoints:
```step
@id flaky
@retry 3
@retry-wait 1000

GET /api/v1/flaky-endpoint

[Asserts]
status == 200
```

### 3. Parallel Execution
Speed up test execution:
```bash
kest run tests/ --parallel --jobs 8
```

### 4. Verbose Logging
View complete request/response details:
```bash
kest run user_auth.flow.md --verbose
```

### 5. Mixed Documentation and Testing
Outside code blocks, you can write detailed Markdown documentation. Kest automatically ignores non-code-block content during execution, making your API documentation itself executable test cases.

## 📘 Getting Help

Run the following command anytime to get the built-in tutorial:
```bash
kest guide
```

---

## 🤖 AI Quick Reference (Cheat Sheet)

| Feature | Syntax | AI Instruction |
| :--- | :--- | :--- |
| **Step Block** | ` ```step ` | **Mandatory** for all new flows. |
| **Exec Step** | `@type exec` | Use for HMAC, token gen, pre-processing. |
| **Capture** | `var = path` | Use `=` for consistency. |
| **Exec Capture** | `var = $line.0` | `$stdout`, `$line.N`, or gjson path. |
| **Injection** | `{{var}}` | Always wrap in double braces. |
| **CLI Vars** | `--var key=value` | Highest priority, overrides everything. |
| **Retry** | `@retry 3` | Use for flaky endpoints. |
| **Timeout** | `--exec-timeout 10` | Default 30s for exec steps. |
| **URL** | `/api/v1/` | **Prefer relative URLs** for portability. |

**Pro Tip for AI**: When writing flows, think in "chains". Step A captures the state, Step B uses the state. For HMAC/signing flows, use `@type exec` to generate fresh credentials before each request. Always include assertions to verify the "vibe".

---

**Keep Every Step Tested. 🦅**
