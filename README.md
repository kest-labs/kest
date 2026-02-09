<div align="center">

# 🦅 Kest

### The API Testing Tool for the AI Era

**curl is stateless. Postman is heavy. Kest remembers everything.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Go Report Card](https://goreportcard.com/badge/github.com/kest-lab/kest-cli)](https://goreportcard.com/report/github.com/kest-lab/kest-cli)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](http://makeapullrequest.com)

[Quick Start](#-quick-start) | [AI Features](#-ai-superpowers) | [Flow Testing](#-markdown-flow) | [Why Kest?](#-why-kest)

</div>

---

## 30 Seconds to Understand Kest

### 1️⃣ Test & Capture — like curl, but it remembers

```bash
kest post /api/login -d '{"user":"admin","pass":"secret"}' -c "token=data.token"
kest get /api/profile -H "Authorization: Bearer {{token}}" -a "status==200"
```

> Variables chain automatically. No manual copy-paste. Every request is auto-recorded.

### 2️⃣ Write Flows — your documentation IS your test suite

> **`login.flow.md`** — a Markdown file that is both documentation and executable test:

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

**Run it:**

```
$ kest run login.flow.md

  ▶ login POST /api/login (line 3)
    ✅ POST /api/login → 200 (142ms)

  ▶ profile GET /api/profile (line 14)
    ✅ GET /api/profile → 200 (89ms)

╭──────────────────────────────────────────────────╮
│                 TEST SUMMARY                      │
├──────────────────────────────────────────────────┤
│ ✓ [POST] /api/login                  142ms │
│ ✓ [GET]  /api/profile                  89ms │
├──────────────────────────────────────────────────┤
│ Total: 2  │  Passed: 2  │  Time: 231ms │
╰──────────────────────────────────────────────────╯
✓ All tests passed!
```

</td></tr></table>

> `.flow.md` files are **Git-diffable**, **PR-reviewable**, and readable by humans AND AI agents. Postman collections are 5000-line JSON blobs.

### 3️⃣ Debug with AI — it sees your full request history

<table><tr><td>

```
$ kest why

🧠 The token expired. Your login was at 14:03, but /api/profile
   was called at 14:18. The JWT has a 15-minute TTL.

   Fix: kest post /api/login -d '...' -c "token=data.token"
```

```
$ kest replay last --diff     # Re-run & compare response changes
$ kest suggest                # AI suggests next logical API call
$ kest explain 42             # AI explains what record #42 does
```

</td></tr></table>

> No collections. No GUI. No cloud account. **Just your terminal.**

---

## 🚀 Quick Start

```bash
# Install
go install github.com/kest-lab/kest-cli/cmd/kest@latest

# Initialize project
kest init

# Start testing
kest get https://api.example.com/health -a "status==200"
```

---

## 🧠 AI Superpowers

Every command below uses your **local request history** as context — something no other tool can do.

| Command | What it does |
|---|---|
| `kest why` | AI diagnoses why your last request failed |
| `kest suggest` | AI suggests the next logical API call |
| `kest explain 42` | AI explains what record #42 does in plain English |
| `kest review auth.flow.md` | AI audits your test file for security gaps |
| `kest gen "test user CRUD"` | AI generates a complete test flow from description |

```bash
# Configure AI (supports OpenAI, Azure, any compatible API)
kest config set ai_key sk-xxx
kest config set ai_model gpt-4o
```

---

## 📝 Markdown Flow

Write tests in Markdown. **Your documentation IS your test suite.**

~~~markdown
# Login Flow

```step
@id login
POST /api/auth/login
Content-Type: application/json

{"email": "admin@test.com", "password": "{{password}}"}

[Captures]
token = data.access_token

[Asserts]
status == 200
duration < 500
```

Token captured! Now use it:

```step
@id profile
GET /api/profile
Authorization: Bearer {{token}}

[Asserts]
status == 200
body.email == "admin@test.com"
```
~~~

```bash
kest run login.flow.md --var password=secret
```

```
🚀 Running 2 step(s) from login.flow.md

  ▶ login POST /api/auth/login (line 3)
    ✅ POST /api/auth/login → 200 (142ms)

  ▶ profile GET /api/profile (line 16)
    ✅ GET /api/profile → 200 (89ms)

╭─────────────────────────────────────────────────────────────────────╮
│                        TEST SUMMARY                                 │
├─────────────────────────────────────────────────────────────────────┤
│ ✓ 14:03:21 [POST] /api/auth/login                142ms │
│ ✓ 14:03:21 [GET]  /api/profile                     89ms │
├─────────────────────────────────────────────────────────────────────┤
│ Total: 2  │  Passed: 2  │  Failed: 0  │  Time: 231ms │
╰─────────────────────────────────────────────────────────────────────╯

✓ All tests passed!
```

**Why Markdown?** Because `.flow.md` files are Git-diffable, PR-reviewable, and readable by humans AND AI agents. Postman collections are 5000-line JSON blobs.

---

## 🔥 Killer Features

### Zero-Config Mock Server

```bash
kest mock --port 8080
# 🎭 Mock server started on :8080
# Auto-generated from 200+ recorded responses:
#   GET  /api/users       → 200
#   POST /api/login       → 200
#   GET  /api/orders/:id  → 200
```

Your request history becomes a mock server. **No setup. No maintenance.** Frontend team gets real response shapes instantly.

### API Snapshot Testing

```bash
kest snap /api/users                  # 📸 Snapshot saved
kest snap /api/users --verify         # ✅ Response matches snapshot
kest snap /api/users --verify         # ❌ Snapshot mismatch! 'role' changed
kest snap /api/users --update         # 📸 Snapshot updated
```

Like Jest snapshots, but for APIs. Catch breaking changes before they ship.

### Request Diffing

```bash
kest diff 100 last
# ╭─── Request Diff ───╮
# │ Response Body:      │
# │ - "role": "admin"   │
# │ + "role": "superadmin"  ← changed!
# ╰─────────────────────╯
```

### File Watch (TDD for APIs)

```bash
kest watch login.flow.md
# 👀 Watching login.flow.md for changes...
# [14:03:21] ✅ All 4 steps passed (1.2s)
# [14:03:35] 📝 File changed, re-running...
# [14:03:36] ✅ All 4 steps passed (0.9s)
```

---

## 🏆 Why Kest?

<table>
<tr>
<td width="33%" valign="top">

### vs curl
curl forgets everything. Kest **remembers every request**, chains variables, asserts responses, and lets AI analyze your history.

</td>
<td width="33%" valign="top">

### vs Postman
Postman needs a GUI, a cloud account, and $$$. Kest lives in your terminal, stores data locally, and the mock server is **free**.

</td>
<td width="33%" valign="top">

### vs Hurl / Bruno
Great tools, but no AI diagnosis, no auto-history, no mock server, no snapshot testing, no file watch.

</td>
</tr>
</table>

| Feature | curl | Postman | Hurl | **Kest** |
|---|:---:|:---:|:---:|:---:|
| Zero config | ✅ | ❌ | ✅ | ✅ |
| Auto history | ❌ | ❌ | ❌ | ✅ |
| AI diagnosis (`why`) | ❌ | ❌ | ❌ | ✅ |
| AI suggestions | ❌ | ❌ | ❌ | ✅ |
| AI test generation | ❌ | ❌ | ❌ | ✅ |
| Mock server | ❌ | 💰 | ❌ | ✅ |
| Snapshot testing | ❌ | 💰 | ❌ | ✅ |
| File watch | ❌ | ❌ | ❌ | ✅ |
| Request diff | ❌ | ❌ | ❌ | ✅ |
| Git-friendly tests | ❌ | ❌ | ✅ | ✅ |
| Variable chaining | ❌ | ✅ | ✅ | ✅ |
| gRPC + TLS | ❌ | ❌ | ❌ | ✅ |
| CI/CD JSON output | ❌ | ❌ | ✅ | ✅ |
| 100% local & private | ✅ | ❌ | ✅ | ✅ |

---

## 📖 Full Command Reference

<details>
<summary><b>HTTP Requests</b></summary>

```bash
kest get /api/users                              # GET
kest post /api/users -d '{"name":"Alice"}'       # POST
kest put /api/users/1 -d '{"name":"Bob"}'        # PUT
kest delete /api/users/1                         # DELETE
kest patch /api/users/1 -d '{"role":"admin"}'    # PATCH

# Flags:
#   -H "Key: Value"     Header
#   -d '{"json":true}'  Body (or -d @file.json)
#   -q "key=value"      Query param
#   -c "var=json.path"  Capture variable
#   -a "status==200"    Assert
#   -v                  Verbose
#   --max-time 5000     Timeout (ms)
#   --retry 3           Retry count
#   --retry-delay 1000  Retry delay (ms)
#   --stream            SSE/streaming
#   --var key=value     Set variable
```

</details>

<details>
<summary><b>History & Comparison</b></summary>

```bash
kest history                # Recent records
kest history -n 50          # Last 50
kest show last              # Full details
kest show 42                # Specific record
kest diff 100 105           # Compare two records
kest diff 100 last          # Compare with latest
kest replay last --diff     # Replay and diff
```

</details>

<details>
<summary><b>Testing & Automation</b></summary>

```bash
kest run login.flow.md                  # Run flow
kest run tests/ --parallel --jobs 8     # Parallel
kest watch login.flow.md                # Auto-rerun
kest snap /api/users                    # Save snapshot
kest snap /api/users --verify           # Verify
kest snap /api/users --update           # Update
kest chain login.flow.md               # Variable flow
```

</details>

<details>
<summary><b>Mock Server</b></summary>

```bash
kest mock                   # Start on :8787
kest mock --port 9090       # Custom port
```

</details>

<details>
<summary><b>gRPC</b></summary>

```bash
kest grpc localhost:50051 pkg.Service/Method -p app.proto -d '{}'
kest grpc api.example.com:443 pkg.Service/Method --tls --cert ca.pem
```

</details>

<details>
<summary><b>Configuration</b></summary>

```bash
kest config set ai_key sk-xxx
kest config set ai_model gpt-4o
kest config list
kest env set staging
kest vars
kest completion zsh
```

</details>

---

## 🏗 How It Works

```
Your Terminal                          Local Storage
┌──────────────────┐                  ┌──────────────┐
│ kest get /users  │──auto-record──→ │ SQLite DB     │
│ kest post /login │──capture vars─→ │ Variables     │
│ kest run flow.md │──assertions──→  │ History       │
└──────────────────┘                  └──────┬───────┘
                                             │
                                    ┌────────▼────────┐
                                    │ AI Analysis      │
                                    │ kest why         │
                                    │ kest suggest     │
                                    │ kest explain     │
                                    └─────────────────┘
```

Everything stays on your machine. No cloud. No account. No telemetry.

---

## 🤝 Contributing

Contributions are welcome! See our [docs/VISION.md](docs/VISION.md) for the project philosophy.

```bash
git clone https://github.com/kest-lab/kest-cli.git
cd kest-cli
go build ./cmd/kest
go test ./...
```

---

## 📜 License

MIT License. See [LICENSE](LICENSE).

---

<div align="center">

**Keep Every Step Tested.** 🦅

[GitHub](https://github.com/kest-lab/kest-cli) | [Report Bug](https://github.com/kest-lab/kest-cli/issues) | [Request Feature](https://github.com/kest-lab/kest-cli/issues)

If Kest saves you time, consider giving it a ⭐

</div>
