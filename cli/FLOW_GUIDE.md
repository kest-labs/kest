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

### 4) Edge Block (Flow Graph) - optional

**You normally do not need edges.** Steps run in file order, top to bottom. A file
with no `edge` blocks is executed exactly like the same file with a
`@from stepN @to stepN+1 @on success` edge between every pair of neighbouring
steps, so do not write those: they are pure boilerplate (`kest lint` reports
them as `redundant-edge` and `kest lint --fix` deletes them).

Edges are only needed for non-linear control flow, i.e. when a step must run
**before** a step that is declared above it:

```edge
@from login
@to profile
@on success
```

How edges work today:

- The runner orders `step` blocks with a topological sort of the edges. Ties
  (steps no edge relates) keep file order.
- `@on` is informational: it labels the edge in Mermaid output and in the web
  graph, but it does not make an edge conditional.
- If edges reference an unknown step or form a cycle, the whole file falls back
  to file order.
- `setup` and `teardown` blocks are never reordered by edges.
- Mermaid output (`-v`) always draws the implicit sequential edges between
  steps that no explicit edge touches.

### 5) Flow-level Defaults (headers and assertions)

67% of steps assert `status == 200` and almost as many repeat a
`Content-Type: application/json` header. Declare them once in the `flow` block:

```flow
@flow id=orders
@default-header Accept: application/json
@default-assert status == 200
@auto-content-type json
```

- `@default-header Name: value` (repeatable) is added to every HTTP step
  (`setup`, `step`, `teardown`) unless the step sets the same header itself.
- `@default-assert <expr>` (repeatable) is appended to every HTTP step's
  assertions unless the step already asserts the same *subject* (first token),
  so a step with its own `status == 201` does not also get `status == 200`.
- `@auto-content-type json` adds `Content-Type: application/json` to a request
  whose body is valid JSON and that has no `Content-Type` header after config
  defaults, flow defaults and step headers are merged.
- A step with `@no-defaults` is left completely untouched. Exec steps are never
  touched.

Why directives and not a new ` ```defaults ` block: the `flow` block already is a
list of `@key value` lines that the parser merges, and an older kest simply
ignores an unknown directive instead of misreading a whole block.

Defaults are resolved when the file is parsed, so they appear everywhere a step
does: run output, `--json` (`assertions`), the HTML report and `kest flow-plan`.

Without `@auto-content-type`, Kest never invents a `Content-Type`: only
`defaults.headers` in `.kest/config.yaml` (written by `kest init`) and your own
headers are sent. Existing flows therefore behave exactly as before.

### 6) Reusing steps: `@use`

```flow
@flow id=orders
@use ./common/login.flow.md
@use ./common/seed.flow.md as seed
```

- The included file's `setup` and `step` blocks run **first**, in the setup
  phase, before the including file's own steps. Its `teardown` blocks are added
  at the end of the including file's teardown.
- Captured variables are shared: after the include, `{{token}}` works as usual
  (variables are **not** prefixed).
- Step ids are namespaced to avoid collisions: `login.<step-id>` (the file name
  without `.flow.md`), or `<alias>.<step-id>` with `as alias`. Nested includes
  compose (`outer.inner.step`).
- Paths are relative to the including file. Missing files, a file that includes
  itself and include cycles are reported with the line of the `@use`.
- Included steps are shown distinctly: console and report names get a
  `[login]` prefix and JSON results carry `"included_from": "./common/login.flow.md"`.
- Defaults (`@default-*`) of the including file are not applied to included
  steps; the included file's own defaults are.

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

### Secrets and Credentials: `{{$env.NAME}}`

Never commit passwords, tokens or API keys into a flow file. Read them from the
environment instead:

```step
@id login
POST /v1/login
Content-Type: application/json

{ "username": "admin", "password": "{{$env.ADMIN_PASSWORD}}" }
```

`{{$env.NAME}}` is resolved from, in order:

1. the OS environment (`ADMIN_PASSWORD=... kest run login.flow.md`) - always wins;
2. the workspace file `.kest/.env` (next to `.kest/config.yaml`), a plain
   `KEY=VALUE` file (`#` comments, optional `export `, single/double quotes).

`kest init` adds `.env` to `.kest/.gitignore`, so `.kest/.env` is never committed.
An application-level `./.env` is **not** read: it usually belongs to the application
under test. An unset name resolves to an empty string. `kest lint` reports
literal secrets as `inline-secret`.

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
