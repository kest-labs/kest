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

- 🏎 **Zero-Config Workflow**: Just `kest get /path` and go. No collection setup needed.
- 📜 **Automatic History**: Every request and response is automatically saved to a local SQLite database.
- 🔗 **Variable Chaining**: Capture fields from JSON responses (`-c token=auth.key`) and use them in subsequent requests (`{{token}}`).
- ✅ **Instant Assertions**: Verify status codes and body content on the fly (`-a status=200`).
- 🔄 **Visual Replay & Diff**: Replay any historical request and see a visual diff if the response has changed.
- 🌍 **Environment Aware**: Easily switch between `dev`, `staging`, and `prod` with inherited base URLs.

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

4. **Replay and verify changes:**
   ```bash
   kest replay last --diff
   ```

---

## 🧠 Why Kest for Vibe Coding?

**Vibe Coding** is a fluid, low-friction way of building software, often collaborating with AI (Cursor, Windsurf, etc.). Kest fits this perfectly:

- **AI Friendly**: Instead of screenshots of a UI, you get CLI outputs that AI can read and fix instantly.
- **Context Preservation**: Your `kest history` is the source of truth for your API progress.
- **Low Cognitive Load**: No context switching between your IDE and a heavy API app.

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

### Global History
```bash
kest history --global  # See requests across all your local projects
```

---

## 🏗 Storage

Kest stores everything locally on your machine:
- **Database**: `~/.kest/records.db` (SQLite)
- **Config**: `~/.kest/config.yaml`

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
