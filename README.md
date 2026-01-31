# 🦅 Kest CLI 

> **Keep Every Step Tested.**  
> *The CLI-first API Testing Tool for Vibe Coding.*

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Go Report Card](https://goreportcard.com/badge/github.com/kest-lab/kest-cli)](https://goreportcard.com/report/github.com/kest-lab/kest-cli)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](http://makeapullrequest.com)

---

## ⚡️ What is Kest?

Kest is a developer-centric API client designed to live in your terminal. Unlike Postman or Insomnia, it doesn't require complex UI collections. It captures your "vibe"—the natural flow of ad-hoc testing during development—and turns it into a searchable, replayable history.

It combines the simplicity of `curl` with the power of **variable capturing** and **logical assertions** inspired by [Hurl](https://hurl.dev).

---

## ✨ Key Features

### 🎯 Core Capabilities
- 🏎 **Zero-Config Workflow**: Just `kest get /path` and go. No collection setup needed.
- 📜 **Automatic History**: Every request and response is automatically saved to a local SQLite database.
- 🔗 **Variable Chaining**: Capture fields from JSON responses (`-c token=auth.key`) and use them in subsequent requests (`{{token}}`).
- ✅ **Instant Assertions**: Verify status codes and body content on the fly (`-a status=200`).
- 🔄 **Visual Replay & Diff**: Replay any historical request and see a visual diff if the response has changed.
- 🌍 **Environment Aware**: Easily switch between `dev`, `staging`, and `prod` with inherited base URLs.

### 🚀 Advanced Features (NEW!)
- 📝 **Markdown Flow**: Write and run complex test chains directly in Markdown files (`.flow.md`)
- � **Variable Chaining**: Capture fields from JSON responses (`-c token=auth.key`) and use them in subsequent requests (`{{token}}`)
- 📊 **Beautiful Test Reports**: Automatic summary with pass/fail stats, durations, and error details
- 🌐 **gRPC Support**: Full gRPC testing with `kest grpc` command
- 📡 **Streaming Support**: Handle LLM and server-sent events with `--stream` flag
- ⚡ **Performance Testing**: Assert response time with `--max-duration 1000`
- 🔄 **Smart Retry**: Handle flaky APIs with `--retry 3 --retry-wait 1000`
- 🏃 **Parallel Execution**: Run test suites blazing fast with `kest run --parallel`

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

1. **Fire a request and capture a variable:**
   ```bash
   kest post /api/login -d '{"user":"admin"}' -c "tk=auth.token"
   ```

2. **Use the variable in a protected route:**
   ```bash
   kest get /api/profile -H "Authorization: Bearer {{tk}}" -a "status=200"
   ```

3. **Check your history:**
   ```bash
   kest history
   ```
   ```
   ID    TIME                 METHOD URL                    STATUS DURATION  
   -------------------------------------------------------------------------
   #34   00:30:16 today       GET    /api/profile           200    178ms   
   #33   00:30:09 today       POST   /api/login             200    234ms    
   ```

4. **Replay and verify changes:**
   ```bash
   kest replay last --diff
   ```

### 🆕 Advanced Testing Features

**Performance Testing:**
```bash
# Fail if response time > 1000ms
kest get /api/fast-endpoint --max-duration 1000
```

**Retry for Flaky APIs:**
```bash
# Retry 3 times with 2-second intervals
kest post /api/payment -d @payment.json --retry 3 --retry-wait 2000
```

**Markdown Flow (Recommended!):**
Kest Flow allows you to define a complete **test chain** in a `.flow.md` file. It's the most powerful way to test business logic involving multiple steps and variable passing.

Example `user.flow.md`:
~~~markdown
# User Lifecycle Flow

## 1. Register
```kest
POST /v1/register
{
  "username": "tester",
  "email": "tester@example.com",
  "password": "password123"
}
[Asserts]
status == 201
```

## 2. Login & Capture Token
```kest
POST /v1/login
{
  "username": "tester",
  "password": "password123"
}
[Captures]
token: data.access_token
[Asserts]
status == 200
```

## 3. Use Token in Header
```kest
GET /v1/users/profile
Authorization: Bearer {{token}}
[Asserts]
status == 200
```
~~~

Run the entire flow:
```bash
kest run user.flow.md
```

**CLI Scenario (.kest):**
Perfect for quick, one-liner test suites.
```bash
# Create a test scenario file
cat > api-tests.kest << EOF
get /api/users/1 --max-duration 500
get /api/users/2 --max-duration 500
post /api/orders -d '{"item":"book"}' --retry 2
EOF

# Run with 8 parallel workers
kest run api-tests.kest --parallel --jobs 8
```

**Test Summary Output:**
```
🚀 Running 4 test(s) from api-tests.kest
⚡ Parallel mode: 8 workers

╭─────────────────────────────────────────────────────────────────────╮
│                        TEST SUMMARY                                 │
├─────────────────────────────────────────────────────────────────────┤
│ ✓ GET      /api/users/1                          178ms │
│ ✓ GET      /api/users/2                           92ms │
│ ✓ POST     /api/orders                           234ms │
│ ✓ GET      /api/health                            45ms │
├─────────────────────────────────────────────────────────────────────┤
│ Total: 4  │  Passed: 4  │  Failed: 0  │  Time: 549ms │
│ Elapsed: 289ms                                                      │
╰─────────────────────────────────────────────────────────────────────╯

✓ All tests passed!
```

**gRPC Testing:**
```bash
# Test a gRPC service
kest grpc localhost:50051 testpkg.TestService Say '{"message":"hello"}'
```

**Streaming Responses:**
```bash
# Handle LLM streaming
kest post /v1/chat/completions -d @prompt.json --stream
```

---

## 🧠 Why Kest for Vibe Coding?

**Vibe Coding** is a fluid, low-friction way of building software, often collaborating with AI (Cursor, Windsurf, etc.). Kest fits this perfectly:

- **AI Friendly**: Instead of screenshots of a UI, you get CLI outputs that AI can read and fix instantly.
- **Context Preservation**: Your `kest history` is the source of truth for your API progress.
- **Low Cognitive Load**: No context switching between your IDE and a heavy API app.
- **Performance Aware**: Built-in duration assertions catch regressions immediately.
- **Reliability First**: Automatic retries help you focus on development, not flaky infrastructure.

---

## 🛠 Advanced Usage

### Variable Management
```bash
kest vars  # List all captured variables for the current environment
```

### Complex Assertions
```bash
# Powered by GJSON syntax
kest get /users/1 -a "body.profile.role=admin" -a "body.tags.0=vip"
```

### Performance Testing
```bash
# Assert response must be under 500ms
kest get /api/search --max-duration 500

# Combine with assertions
kest get /api/users -a "status=200" --max-duration 1000
```

### Retry Mechanism
```bash
# Retry failed requests up to 5 times
kest post /api/webhook -d @data.json --retry 5 --retry-wait 1000

# Unlimited retries (use with caution!)
kest get /eventually-consistent --retry -1
```

### Parallel Test Execution
```bash
# Run with default 4 workers
kest run tests.kest --parallel

# Use 16 workers for maximum speed
kest run tests.kest --parallel --jobs 16
```

### Global History
```bash
kest history --global  # See requests across all your local projects
```

### Debugging
```bash
# Enable verbose mode
kest get /api/debug -v

# Check detailed logs (when log_enabled: true in config)
cat .kest/logs/2026-01-30_00-30-16_GET_api_users.log
```

---

## 🏗 Storage

Kest stores everything locally on your machine:
- **Database**: `~/.kest/records.db` (SQLite)
- **Config**: `~/.kest/config.yaml`
- **Logs**: `.kest/logs/` (project) or `~/.kest/logs/` (global)

---

## 📖 Documentation

- **[SCENARIO_GUIDE.md](SCENARIO_GUIDE.md)** - Complete guide on creating and managing test scenarios
- **[NEW_FEATURES.md](NEW_FEATURES.md)** - Detailed documentation of new features
- **[GUIDE.md](GUIDE.md)** - User guide (Chinese)
- **[FAQ.md](FAQ.md)** - Frequently asked questions
- **[UPDATE_SUMMARY.md](UPDATE_SUMMARY.md)** - Latest update summary

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
  <i>Happy Vibe Coding! 🚀</i>
</p>
