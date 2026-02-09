<div align="center">

# 🦅 Kest

### The CLI-First API Testing Tool Built for Vibe Coding

**curl is stateless. Postman is heavy. Kest remembers everything.**

*Built for developers who live in the terminal with AI copilots — Cursor, Windsurf, Copilot, Cline.*

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Go Report Card](https://goreportcard.com/badge/github.com/kest-labs/kest)](https://goreportcard.com/report/github.com/kest-labs/kest)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](http://makeapullrequest.com)

[Website](https://kest.dev) | [Quick Start](#-quick-start) | [Why Kest?](#-why-kest) | [Docs](https://kest.dev/docs)

</div>

---

## 🚀 Quick Start

```bash
curl -fsSL https://kest.dev/install.sh | sh
```

Or via Go: `go install github.com/kest-labs/kest/cmd/kest@latest`

```bash
kest init                                                    # Initialize project
kest get /api/users -a "status==200"                         # Test an endpoint
kest post /api/login -d '{"user":"admin"}' -c "token=data.token"  # Capture token
kest get /api/profile -H "Authorization: Bearer {{token}}"   # Use it instantly
```

> Every request is auto-recorded. Variables chain automatically. No copy-paste.

---

## ⚡ Why Kest?

Kest is designed for **Vibe Coding** — the workflow where you and an AI copilot build together in the terminal.

<table>
<tr>
<td width="50%">

**Without Kest**
- curl forgets every response
- Copy-paste tokens between requests
- API broke? Manually re-test everything
- Postman needs GUI + cloud account + $$$
- Test files are 5000-line JSON blobs
- Switch between IDE and Postman constantly

</td>
<td width="50%">

**With Kest**
- Every request auto-recorded to local DB
- Variables chain: `-c "token=data.token"` → `{{token}}`
- `kest replay last --diff` — instant regression check
- 100% terminal, 100% local, 100% free
- `.flow.md` — Markdown that AI reads natively
- Runs inline in Cursor/Windsurf terminal

</td>
</tr>
</table>

> **The Vibe Coding loop:** `kest` → AI sees output → AI suggests fix → `kest replay` → verified. All in one terminal.

---

## 🧠 AI-Powered

Kest uses your **local request history** as context for AI — something no other tool can do.

```bash
kest why                           # AI diagnoses why your last request failed
kest suggest                       # AI suggests the next logical API call
kest explain 42                    # AI explains what record #42 does
kest review auth.flow.md           # AI audits your flow for security gaps
kest gen "test user registration"  # AI generates a complete .flow.md
```

```bash
kest config set ai_key sk-xxx      # Supports OpenAI, Azure, any compatible API
kest config set ai_model gpt-4o
```

---

## 📝 Markdown Flow — Documentation IS Your Test Suite

Write tests as `.flow.md` files — readable by humans, executable by Kest, reviewable in PRs.

~~~markdown
```step
@id login
POST /api/login
Content-Type: application/json
{"user": "admin", "pass": "secret"}

[Captures]
token = data.token

[Asserts]
status == 200
```

```step
@id profile
GET /api/profile
Authorization: Bearer {{token}}

[Asserts]
status == 200
body.user == "admin"
```
~~~

<table><tr><td>

```
$ kest run login.flow.md

  ▶ login POST /api/login
    ✅ 200 (142ms)

  ▶ profile GET /api/profile
    ✅ 200 (89ms)

╭──────────────────────────────────────────────────╮
│                 TEST SUMMARY                      │
├──────────────────────────────────────────────────┤
│ ✓ [POST] /api/login                  142ms │
│ ✓ [GET]  /api/profile                  89ms │
├──────────────────────────────────────────────────┤
│ Total: 2  │  Passed: 2  │  Time: 231ms │
╰──────────────────────────────────────────────────╯
```

</td></tr></table>

---

## 🔥 More Features

### Mock Server — zero config, from your history

```bash
kest mock --port 8080
# Serves recorded responses automatically
# GET  /api/users → 200    POST /api/login → 200
```

### Snapshot Testing — like Jest, but for APIs

```bash
kest snap /api/users              # Save snapshot
kest snap /api/users --verify     # ❌ 'role' field changed!
kest snap /api/users --update     # Accept new snapshot
```

### Replay & Diff — instant regression detection

```bash
kest replay last --diff
# - "role": "admin"
# + "role": "superadmin"  ← changed!
```

### File Watch — TDD for APIs

```bash
kest watch login.flow.md
# [14:03:21] ✅ All 4 steps passed (1.2s)
# [14:03:35] 📝 File changed, re-running...
# [14:03:36] ✅ All 4 steps passed (0.9s)
```

### gRPC + TLS

```bash
kest grpc localhost:50051 pkg.Service/Method -p app.proto -d '{}'
kest grpc api.example.com:443 pkg.Service/Method --tls --cert ca.pem
```

### SSE / LLM Streaming

```bash
kest post /v1/chat/completions -d '{"stream":true, ...}' --stream
```

---

## 🏆 Comparison

| Feature | curl | Postman | Hurl | **Kest** |
|---|:---:|:---:|:---:|:---:|
| Zero config | ✅ | ❌ | ✅ | ✅ |
| Auto history | ❌ | ❌ | ❌ | **✅** |
| Variable chaining | ❌ | ✅ | ✅ | ✅ |
| AI diagnosis | ❌ | ❌ | ❌ | **✅** |
| AI test generation | ❌ | ❌ | ❌ | **✅** |
| Mock server | ❌ | 💰 | ❌ | **✅** |
| Snapshot testing | ❌ | 💰 | ❌ | **✅** |
| File watch | ❌ | ❌ | ❌ | **✅** |
| Replay & diff | ❌ | ❌ | ❌ | **✅** |
| gRPC + TLS | ❌ | ❌ | ❌ | **✅** |
| Git-friendly tests | ❌ | ❌ | ✅ | ✅ |
| SSE streaming | ❌ | ❌ | ❌ | **✅** |
| CI/CD ready | ❌ | ❌ | ✅ | ✅ |
| 100% local | ✅ | ❌ | ✅ | ✅ |

---

## 📖 Command Reference

<details>
<summary><b>HTTP Requests</b></summary>

```bash
kest get /api/users                              # GET
kest post /api/users -d '{"name":"Alice"}'       # POST with JSON body
kest put /api/users/1 -d '{"name":"Bob"}'        # PUT
kest delete /api/users/1                         # DELETE
kest post /api/upload -d @file.json              # Body from file

# Flags
-H "Key: Value"       # Header
-q "key=value"        # Query param
-c "var=json.path"    # Capture variable
-a "status==200"      # Assertion
-v                    # Verbose (show headers)
--max-time 5000       # Timeout (ms)
--retry 3             # Retry count
--retry-delay 1000    # Retry delay (ms)
--stream              # SSE streaming
--var key=value       # Set variable
```

</details>

<details>
<summary><b>History & Replay</b></summary>

```bash
kest history                # Recent records
kest history -n 50          # Last 50
kest show last              # Full request/response details
kest show 42                # Specific record
kest diff 100 last          # Compare two records
kest replay last --diff     # Re-execute and compare
```

</details>

<details>
<summary><b>Testing & Automation</b></summary>

```bash
kest run login.flow.md                  # Run flow file
kest run login.flow.md --var key=val    # With variables
kest run tests/ --parallel --jobs 8     # Parallel execution
kest watch login.flow.md                # Auto-rerun on change
kest snap /api/users                    # Save snapshot
kest snap /api/users --verify           # Verify against snapshot
kest mock --port 8080                   # Mock server from history
```

</details>

<details>
<summary><b>Configuration</b></summary>

```bash
kest init                   # Initialize project
kest config set ai_key sk-xxx
kest config set ai_model gpt-4o
kest env set staging        # Switch environment
kest vars                   # List captured variables
kest completion zsh         # Shell completion
```

</details>

---

## 🏗 Architecture

```
Terminal                              Local Storage
┌──────────────────┐                 ┌──────────────┐
│ kest get /users  │──auto-record──→│ SQLite DB     │
│ kest post /login │──capture var──→│ Variables     │
│ kest run flow.md │──assertions──→ │ History       │
└──────────────────┘                 └──────┬───────┘
                                            │
                                   ┌────────▼────────┐
                                   │ AI Engine        │
                                   │ why · suggest    │
                                   │ explain · review │
                                   └─────────────────┘
```

**100% local.** No cloud. No account. No telemetry. Your data never leaves your machine.

---

## 🤝 Contributing

```bash
git clone https://github.com/kest-labs/kest.git
cd kest-cli
go build ./cmd/kest
go test ./...
```

See [docs/VISION.md](docs/VISION.md) for project philosophy. PRs welcome!

---

<div align="center">

**Keep Every Step Tested.** 🦅

[Website](https://kest.dev) · [GitHub](https://github.com/kest-labs/kest) · [Report Bug](https://github.com/kest-labs/kest/issues)

If Kest saves you time, consider giving it a ⭐

MIT License — See [LICENSE](LICENSE)

</div>
