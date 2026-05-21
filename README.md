# 🦅 Kest

### The AI-Native API Testing Platform for Vibe Coding

**curl is stateless. Postman is heavy. Kest remembers everything.**

Kest is the unified platform for modern API development, built for those who live in the terminal with AI copilots (Cursor, Windsurf, Cline, Copilot). It combines a high-performance CLI with a collaborative web dashboard.

---

## 🏗 Unified Monorepo Structure

Kest is organized as a flat, high-visibility monorepo to ensure perfect synchronization between the tool, the brain, and the interface.

- **[cli/](./cli)**: The core Kest CLI. High-speed, markdown-native, and AI-powered.
- **[api/](./api)**: The Platform Backend. Handles team collaboration, data persistence, and AI diagnosis logic.
- **[web/](./web)**: The Web Console. A sleek Next.js dashboard for visualizing test flows and team activity.

---

## 🚀 Quick Start

### 1. Install the CLI
The fastest way to get started with the Kest toolset:
```bash
curl -fsSL https://kest.dev/install.sh | sh
```
*Built via GoReleaser. Supported on macOS, Linux, and Windows.*

### 2. Basic Usage
```bash
kest init                                                    # Initialize workspace
kest get /api/users -a "status==200"                         # Test an endpoint
kest post /api/login -d '{"user":"admin"}' -c "token=data.token"  # Capture token
kest run auth.flow.md                                        # Run a Markdown flow
```

### 3. Connect CLI To The Web Console

Use this flow when you want to push local CLI history back into a Kest workspace as API Specs.

1. Open the target workspace in the Web Console.
2. Go to the workspace detail page.
3. In the `CLI Sync` card, click `Generate CLI Token`.
4. Copy the one-time token or the generated setup command.

Then configure the CLI once inside your local Kest workspace:

```bash
kest sync config \
  --platform-url "https://api.kest.dev/v1" \
  --platform-token "kest_pat_..." \
  --workspace-id "12"
```

This writes the following fields into `.kest/config.yaml`:

```yaml
platform_url: https://api.kest.dev/v1
platform_token: kest_pat_...
platform_workspace_id: "12"
```

Check the saved configuration:

```bash
kest config list
```

Preview what will be uploaded:

```bash
kest sync push --dry-run
```

Then run the real upload:

```bash
kest sync push
```

Notes:

- `platform_token` is a Kest workspace token, not an OpenAI `sk-...` key.
- The token is scoped to a single workspace and is checked against the URL workspace ID on upload.
- The CLI upload endpoint is `POST /v1/workspaces/:id/cli/spec-sync`.

---

## 🧠 Built for Vibe Coding

Traditional API tools were designed for manual entry. Kest was designed for the AI era:

*   **Markdown-Native (`.flow.md`)**: Write tests that both humans and AI can read natively.
*   **Zero-Copy Chaining**: Automatically capture variables from one request and use them in the next.
*   **AI Diagnosis (`kest why`)**: When a test fails, let the AI diagnose the root cause using your local request history.
*   **Snapshot Testing**: Catch regressions instantly without writing boilerplate assertions.

---

## 🤝 Contributing & Development

Since this is a Monorepo, you can develop all components simultaneously using Go Workspaces.

```bash
git clone https://github.com/kest-labs/kest.git
cd kest

# The workspace is already configured via go.work
# Build the CLI
cd cli && go build -o kest .
```

---

## 📜 License

Apache 2.0 License. See [LICENSE](LICENSE) for details.

<div align="center">
  <br />
  <b>Keep Every Step Tested.</b> 🦅
</div>
