# Kest CLI User Guide

Kest CLI is a **CLI-first** API testing tool designed for developers. Core philosophy: **Test instantly. Record automatically. Replay effortlessly.**

---

## 1. Installation

Make sure you have Go installed, then run:

```bash
go install github.com/kest-labs/kest/cmd/kest@latest
```

After installation, ensure `$(go env GOPATH)/bin` is in your system `PATH`.

---

## 2. Quick Start

### 2.1 Initialize a Project

Run this in your project root. It creates a `.kest/config.yaml` file for base URLs, environment variables, and default headers.

```bash
kest init
```

### 2.2 Make Requests

Kest supports all standard HTTP methods and **auto-records** every request/response. The CLI is designed to be minimal and fast — perfect for **Vibe Coding** (working with AI in Cursor/Windsurf terminals).

#### Common Examples

```bash
# GET request (relative paths auto-prepend base_url)
kest get /users/1

# POST request (defaults to application/json)
kest post /users -d '{"name": "stark"}'

# Custom headers
kest get /protected -H "Authorization: Bearer token123"

# Multiple query parameters
kest get /search -q "q=kest" -q "page=1"

# Verbose mode (see full headers)
kest get /users/1 -v

# LLM streaming responses (Server-Sent Events)
kest post /chat/completions -d '{"stream": true, ...}' --stream

# Performance assertion: response must be < 1000ms
kest get /api/users --max-time 1000

# Retry on failure: up to 3 retries, 2s delay
kest post /api/payment -d @payment.json --retry 3 --retry-delay 2000

# gRPC testing
kest grpc localhost:50051 mypackage.MyService SayHello '{"name":"World"}'
```

### 2.3 Vibe Coding Workflow

Vibe Coding emphasizes **fluid, high-frequency, low-friction** development. Kest fits this style perfectly:

1. **Zero-config mindset**: No need to create collections in a GUI. Just type the command in your terminal.
2. **AI collaboration**:
   - Tell your AI: "Test the create order endpoint with kest."
   - AI generates: `kest post /orders -d '{"item_id": 101, "count": 2}'`
   - Kest auto-records the request and response. If it fails, paste the output to AI — no screenshots needed.
3. **History as documentation**: Your `kest history` is the most accurate, up-to-date record of API interactions.
4. **Instant replay verification**: After AI modifies backend logic, run `kest replay last --diff` to verify the change didn't break anything — without leaving your IDE.

#### Pro Tips

- **Pipe to `jq`**: `kest get /users --quiet --output json | jq '.[0].id'`
- **Shell alias**: Add `alias k='kest'` to `.zshrc` — then `k get /path` is all you need.
- **One-command error context**: When a request fails, tell AI: "Check the last kest record and fix the backend." AI reads `kest show last` output for full context.

---

## 3. Advanced Features

Inspired by [Hurl](https://hurl.dev), Kest supports **variable capturing** and **assertions** directly from the command line.

### 3.1 Variable Capturing

Extract fields from response bodies and save them as variables for subsequent requests. Uses **gjson** syntax.

```bash
# Capture token from login response
kest post /login -d '{"user":"admin"}' -c "token=data.token"

# View saved variables
kest vars

# Use variables in subsequent requests
kest get /profile -H "Authorization: Bearer {{token}}"
```

### 3.2 Assertions

Verify responses inline. Failures are reported explicitly.

```bash
# Assert status code and body fields
kest get /users/1 -a "status==200" -a "body.name==stark"

# Assert with captured variables
kest get /orders/{{last_id}} -a "status==200" -a "body.status==pending"
```

### 3.3 Performance Testing

Use `--max-time` to assert response duration:

```bash
# Require response within 500ms
kest get /api/search --max-time 500

# Combine with other assertions
kest get /api/users -a "status==200" --max-time 1000

# Failure output:
# ❌ Request Failed: duration assertion failed: 1234ms > 1000ms
```

### 3.4 Retry Mechanism

Handle flaky APIs or network issues:

```bash
# Retry 3 times with 1s delay
kest post /api/order -d @order.json --retry 3 --retry-delay 1000

# Unlimited retries (use with caution!)
kest get /eventually-consistent --retry -1 --retry-delay 5000

# Retry output:
# ⏱️  Retry attempt 1/3 (waiting 1000ms)...
# ⏱️  Retry attempt 2/3 (waiting 1000ms)...
# ✅ Request succeeded on retry 2
```

---

## 4. AI-Powered Commands

Kest uses your local request history as context for AI analysis.

```bash
kest why                           # Diagnose last failed request
kest suggest                       # AI suggests next command
kest explain last                  # AI explains a recorded request
kest review login.flow.md          # AI audits flow for security/coverage
kest gen "test user registration"  # AI generates a flow file
```

Configure AI:
```bash
kest config set ai_key sk-xxx
kest config set ai_model gpt-4o
```

---

## 5. gRPC Support

Kest supports gRPC testing via dynamic reflection — no pre-compilation needed.

```bash
# Call a gRPC method
# Format: kest grpc [host:port] [service/method] -p [proto] -d [json]
kest grpc localhost:50051 User/GetInfo -p user.proto -d '{"id": 1}'

# With TLS
kest grpc api.example.com:443 User/GetInfo --tls --cert ca.pem

# Verbose mode
kest grpc localhost:50051 User/GetInfo -p user.proto -d '{}' -v
```

---

## 6. Scenarios & Flow Files

### 6.1 Scenario Scripts (.kest)

For batch execution of multiple requests:

```text
# Login and capture token
POST /login -d '{"user":"admin"}' -c "token=data.token"

# Use token to get config
GET /config -H "Authorization: Bearer {{token}}" -a "status==200"

# Test streaming
POST /generate -d '{"model":"gpt"}' --stream
```

### 6.2 Running Scenarios

```bash
# Sequential (default)
kest run api.kest

# Parallel with 8 workers
kest run api.kest --parallel --jobs 8
```

### 6.3 Markdown Flow (.flow.md)

The recommended way to write tests. See [FLOW_GUIDE.md](FLOW_GUIDE.md) for the full guide.

```bash
kest run login.flow.md
kest run login.flow.md --var password=secret
```

### 6.4 Generate from OpenAPI

```bash
kest generate --from-openapi swagger.json -o project.kest
```

---

## 7. History & Tracing

Kest automatically records every request you make.

### 7.1 View History

- **Project history** (default): `kest history` shows only the current project's records
- **Global history**: `kest history --global` shows records across all projects

```bash
# View recent records for current project
kest history

# View all projects (global)
kest history --global

# Specify count
kest history -n 50

# Example output:
# ID    TIME                 METHOD URL                    STATUS DURATION
# -------------------------------------------------------------------------
# #34   00:30:16 today       GET    /api/profile           200    178ms
# #33   00:30:09 today       POST   /api/login             200    234ms
```

### 7.2 View Details

View the full request and response (headers + formatted body) for any record.

```bash
kest show 42          # Specific record
kest show last        # Most recent record
```

---

## 8. Replay & Diff

After modifying code, verify that API responses haven't changed unexpectedly.

### 8.1 Re-execute a Request

```bash
kest replay 42
kest replay last
```

### 8.2 Visual Diff

Kest replays the request and compares the new response body against the original.

```bash
kest replay 42 --diff
kest replay last --diff
```

---

## 9. Environments

Define multiple environments (`dev`, `staging`, `prod`) in `.kest/config.yaml`.

### 9.1 List and Switch

```bash
# List all environments
kest env list

# Switch to staging
kest env set staging
```

After switching, all relative URLs (e.g. `/users`) auto-prepend the environment's `base_url`.

---

## 10. Configuration Reference

```yaml
version: 1
defaults:
  timeout: 30
  headers:
    Content-Type: application/json
    Accept: application/json

environments:
  dev:
    base_url: http://localhost:3000
  staging:
    base_url: https://staging-api.example.com
  prod:
    base_url: https://api.example.com

active_env: dev
```

---

## 11. Data Storage

- **Global database**: `~/.kest/records.db` (all test records)
- **Global config**: `~/.kest/config.yaml`
- **Project config**: `.kest/config.yaml` (in project directory)
- **Logs**: `.kest/logs/` (project) or `~/.kest/logs/` (global)
- **Snapshots**: `.kest/snapshots/` (project)

---

*Keep Every Step Tested.* 🦅
