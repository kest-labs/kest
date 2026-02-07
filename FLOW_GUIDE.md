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

### 2) Step Block
```step
@id login
@name Login
@type http
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

### 3) Edge Block (Flow Graph)
```edge
@from login
@to profile
@on success
```

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

When variables with the same name come from multiple sources, the priority is:

1. **Runtime Capture** - Variables captured via `[Captures]` in Flow (Highest Priority)
2. **Config File** - Static variables defined in `.kest/config.yaml`
3. **Built-in Variables** - `$randomInt`, `$timestamp`

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

# Parallel execution (if you have multiple flows)
kest run tests/ --parallel --jobs 4
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
```kest
GET /api/v1/flaky-endpoint

[Asserts]
status == 200
# Use command line parameters: kest run --retry 3 --retry-wait 1000
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
| **Capture** | `var = path` | Use `=` for consistency. |
| **Injection** | `{{var}}` | Always wrap in double braces. |
| **Retry** | `@retry 3` | Use for flaky endpoints. |
| **URL** | `/api/v1/` | **Prefer relative URLs** for portability. |

**Pro Tip for AI**: When writing flows, think in "chains". Step A captures the state, Step B uses the state. Always include assertions to verify the "vibe".

---

**Keep Every Step Tested. 🦅**
