# 🦅 Kest CLI

> **Keep Every Step Tested.**
> *The CLI-first API Testing Tool for Vibe Coding.*

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Go Report Card](https://goreportcard.com/badge/github.com/kest-lab/kest-cli)](https://goreportcard.com/report/github.com/kest-lab/kest-cli)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](http://makeapullrequest.com)

---

## ⚡️ What is Kest?

Kest is a developer-centric API client designed to live in your terminal. Unlike Postman or Insomnia, it doesn't require complex UI collections. It captures your "vibe"—the natural flow of ad-hoc testing during development—and turns it into a searchable, replayable, AI-analyzable history.

It combines the simplicity of `curl` with the power of **variable capturing**, **logical assertions**, **AI diagnosis**, and **zero-config mock servers**.

---

## ✨ Key Features

### 🎯 Core
- **Zero-Config Workflow**: Just `kest get /path` and go. No collection setup needed.
- **Automatic History**: Every request/response is saved to a local SQLite database.
- **Variable Chaining**: Capture fields from responses (`-c token=data.token`) and reuse them (`{{token}}`).
- **Instant Assertions**: Verify status, body, and duration on the fly (`-a "status==200"`).
- **Visual Replay & Diff**: Replay any request and see a colorized diff if the response changed.
- **Environment Aware**: Switch between `dev`, `staging`, `prod` with inherited base URLs.

### 🧠 AI-Powered (NEW!)
- **`kest why`** — AI diagnoses why your last request failed, with context from history.
- **`kest suggest`** — AI suggests the next command based on your history and captured variables.
- **`kest explain`** — AI explains what a recorded API interaction does, for onboarding.
- **`kest review`** — AI audits a flow file for security gaps and missing coverage.
- **`kest gen`** — AI generates a `.flow.md` from a natural language description.

### 🚀 Developer Workflow (NEW!)
- **`kest diff`** — Colorized side-by-side comparison of any two recorded requests.
- **`kest mock`** — Zero-config mock server auto-generated from your request history.
- **`kest watch`** — File watcher with auto-rerun, like `jest --watch` for APIs.
- **`kest snap`** — API snapshot testing: capture, verify, and detect regressions.
- **`kest chain`** — Visualize variable flow between steps in a flow file.

### 🔧 Production-Grade
- **Markdown Flow** (`.flow.md`): Document and test APIs simultaneously in Markdown.
- **gRPC Support**: Full gRPC testing with `--tls` and `--cert` for secure connections.
- **Streaming**: Handle LLM and SSE responses with `--stream`.
- **Performance**: Assert response time with `--max-time 1000`.
- **Retry**: Handle flaky APIs with `--retry 3 --retry-delay 1000`.
- **Parallel Execution**: Run test suites fast with `kest run --parallel --jobs 8`.
- **Shell Completion**: `kest completion bash|zsh|fish|powershell`.
- **CI/CD Ready**: `--quiet` for clean output, `--output json` for structured data, exit codes (0=pass, 1=assertion fail, 2=runtime error).

---

## 🚀 Quick Start

### Installation

```bash
go install github.com/kest-lab/kest-cli/cmd/kest@latest
```

### Initialize Project

```bash
kest init
```

### The "Vibe" Loop

```bash
# 1. Fire a request and capture a variable
kest post /api/login -d '{"user":"admin"}' -c "tk=data.token"

# 2. Use the variable in a protected route
kest get /api/profile -H "Authorization: Bearer {{tk}}" -a "status==200"

# 3. Check your history
kest history

# 4. Something broke? Ask AI
kest why

# 5. What should I do next?
kest suggest
```

---

## 📖 Command Reference

### HTTP Requests

```bash
kest get /api/users                              # Simple GET
kest post /api/users -d '{"name":"Alice"}'       # POST with body
kest put /api/users/1 -d '{"name":"Bob"}'        # PUT
kest delete /api/users/1                         # DELETE
kest patch /api/users/1 -d '{"role":"admin"}'    # PATCH

# Common flags:
#   -H "Key: Value"     Request header
#   -d '{"json":true}'  Request body (or -d @file.json)
#   -q "key=value"      Query parameter
#   -c "var=json.path"  Capture variable from response
#   -a "status==200"    Assert response
#   -v                  Verbose output
#   --max-time 5000     HTTP timeout in milliseconds
#   --retry 3           Retry on failure
#   --retry-delay 1000  Delay between retries in ms
#   --stream            Handle streaming responses
#   --var key=value     Set variables for interpolation
```

### AI Commands

```bash
kest why                    # Diagnose last failed request
kest why 42                 # Diagnose a specific record
kest suggest                # AI suggests next command from history
kest explain last           # Explain what a request does
kest explain 42             # Explain a specific record
kest review login.flow.md   # AI security/coverage audit
kest gen "test user CRUD"   # Generate flow from description
kest gen "login flow" -o auth.flow.md
```

### History & Comparison

```bash
kest history                # Show recent records
kest history -n 50          # Show last 50
kest history --global       # All projects
kest show last              # Full details of last request
kest show 42                # Full details of record #42
kest diff 100 105           # Compare two records
kest diff 100 last          # Compare with latest
kest replay last            # Re-execute last request
kest replay last --diff     # Replay and show response diff
```

### Testing & Automation

```bash
kest run login.flow.md                  # Run a flow file
kest run tests/ --parallel --jobs 8     # Parallel execution
kest watch login.flow.md                # Auto-rerun on file change
kest snap /api/users                    # Save response snapshot
kest snap /api/users --verify           # Verify against snapshot
kest snap /api/users --update           # Update snapshot
kest chain login.flow.md               # Visualize variable flow
```

### Mock Server

```bash
kest mock                   # Start mock server on :8787
kest mock --port 9090       # Custom port

# Auto-generates routes from your request history.
# Frontend team can develop against real response shapes.
```

### gRPC

```bash
kest grpc localhost:50051 pkg.Service/Method -p app.proto -d '{}'
kest grpc api.example.com:443 pkg.Service/Method --tls
kest grpc api.example.com:443 pkg.Service/Method --tls --cert ca.pem
```

### Configuration

```bash
kest config set ai_key sk-xxx          # Set AI API key
kest config set ai_model gpt-4o        # Set AI model
kest config set ai_base_url https://... # Custom AI endpoint
kest config list                        # Show config
kest env set staging                    # Switch environment
kest env list                           # List environments
kest vars                               # Show captured variables
```

### Utilities

```bash
kest completion zsh > "${fpath[1]}/_kest"   # Shell completion
kest guide                                   # Flow tutorial
kest guide doc                               # Doc generation guide
kest doc ./api -o ./docs --ai               # Generate API docs
```

---

## � Markdown Flow (.flow.md)

The most powerful way to test APIs. **Document and test simultaneously.**

~~~markdown
# User Authentication Flow

```flow
@flow id=auth-flow
@name Authentication Flow
```

## 1. Login

```step
@id login
@name User Login

POST /api/v1/auth/login
Content-Type: application/json

{"username": "admin", "password": "{{password}}"}

[Captures]
token = data.access_token

[Asserts]
status == 200
duration < 500
```

## 2. Get Profile

```step
@id profile
@name Get User Profile

GET /api/v1/profile
Authorization: Bearer {{token}}

[Asserts]
status == 200
body.username == "admin"
```
~~~

```bash
kest run auth.flow.md --var password=secret123
```

---

## 🧠 Why Kest over Postman?

| Feature | curl | Postman | Kest |
|---|---|---|---|
| Zero config | ✅ | ❌ | ✅ |
| Auto history | ❌ | ❌ | ✅ |
| AI diagnosis | ❌ | ❌ | ✅ `kest why` |
| AI suggestions | ❌ | ❌ | ✅ `kest suggest` |
| AI flow generation | ❌ | ❌ | ✅ `kest gen` |
| Mock server | ❌ | 💰 Paid | ✅ Free, auto-generated |
| Snapshot testing | ❌ | 💰 Paid | ✅ `kest snap` |
| File watch | ❌ | ❌ | ✅ `kest watch` |
| Git-friendly tests | ❌ | ❌ | ✅ `.flow.md` |
| CI/CD JSON output | ❌ | ❌ | ✅ `--output json` |
| Request diff | ❌ | ❌ | ✅ `kest diff` |
| Variable chain viz | ❌ | ❌ | ✅ `kest chain` |
| gRPC + TLS | ❌ | ❌ | ✅ `--tls --cert` |
| Shell completion | ❌ | N/A | ✅ bash/zsh/fish |
| Local & private | ✅ | ❌ Cloud | ✅ SQLite |

---

## 🏗 Storage

Kest stores everything locally on your machine:
- **Database**: `~/.kest/records.db` (SQLite)
- **Config**: `~/.kest/config.yaml` or `.kest/config.yaml` (project)
- **Logs**: `.kest/logs/` (project) or `~/.kest/logs/` (global)
- **Snapshots**: `.kest/snapshots/` (project)

---

## 🤝 Contributing

We love contributions! Whether it's a bug report, a new feature, or better documentation, feel free to open a PR.

1. Fork the repo.
2. Create your feature branch.
3. Commit your changes.
4. Push to the branch.
5. Open a Pull Request.

---

## 📜 License

Distributed under the MIT License. See `LICENSE` for more information.

---

<p align="center">
  <b>Keep Every Step Tested.</b> 🦅
</p>
