# Onboarding audit: install to first success

Goal (P0-4): a new user goes from install to a first verified API call, a first
flow, a failure they can act on, and an agent hooked up over MCP, in at most
3 minutes.

## Method

Fresh `HOME` and an empty repository directory, a binary built from
`feat/cli-polish`, and a small local JSON API (`/health`, `/api/users`,
`POST /api/login`, `/api/profile` with a bearer token) on ports 3000 and 8080.
Path walked, using only what the docs and command output say:

`kest init` → `kest get` → README `login.flow.md` → `kest run` → break an
assertion → `kest why` / `kest show` / `kest replay` → `kest history` →
`kest mcp` (initialize, `tools/list`, `kest_request`, `kest_run_flow` over
stdio) → the literal quickstart commands from `cli/README.md` and
`docs-site/en/documentation/quickstart.mdx`.

Result after the fixes below: the quickstart runs as written in under a minute
once the API server is up. Before the fixes, the first `kest run` failed with
`dial tcp 127.0.0.1:5119: connection refused`, which a new user cannot explain
without reading the source.

Severity: **P0** blocks the path, **High** costs minutes or needs outside
help, **Medium** confusing but recoverable, **Low** polish.

## Fixed on this branch

| # | Severity | Friction | Fix |
|---|----------|----------|-----|
| 1 | P0 | `kest run` used the built-in `local` profile, which forced `base_url: http://127.0.0.1:5119` and `env: local` (Kest's own dev setup). `kest get` went to the config's `dev` base URL, so the first flow failed with connection refused. Removing `base_url` from `flow.config.yaml` did not help, because it was merged back from the defaults. | The default `local` profile and the `kest init` template no longer set `env` or `base_url`, so flows use the active environment from `config.yaml`. |
| 2 | High | `kest init` created an empty `flow/` directory and printed only a file list, with no next step and no sample flow. | `kest init` writes `.kest/flow/smoke.flow.md`, which runs against any server. It also prints the next three commands, including `claude mcp add kest -- kest mcp`. |
| 3 | High | `kest init` did not say where requests go. `http://localhost:3000` was only in `config.yaml`. | New `kest init --base-url <url>` flag. Init also prints the target URL and how to change it. |
| 4 | High | When a flow failed, the only hint was "Run 'kest guide'". The failed step's record ID was never printed. | The run now prints the failed step's record ID followed by the `kest show`, `kest why` and `kest replay` commands for it. |
| 5 | High | Every command warned `failed to load config: ... no such file or directory`, sometimes twice. | A missing config is silent. Real errors warn once. `~/.kest` is no longer treated as a workspace root (separate commit). |
| 6 | High | Network errors, timeouts and `--max-time` failures were not saved to history, so `kest why` diagnosed an older request. | These failures are now saved with status 0 and the error text (separate commit). |
| 7 | Medium | Without an AI key, `kest why` stopped with an error and gave no alternative. | The message now also suggests `kest show <id>`. |
| 8 | Medium | `kest history` and `kest show` printed UTC times labelled "today". | Both now print local time. |
| 9 | Medium | A flow step that got a 4xx and passed its assertions (for example `status < 500`) still printed a `--- Debug Info ---` dump in the middle of the run. | In flows the dump is only shown with `--verbose`. Failures are reported in the summary. |
| 10 | Medium | The docs-site "Quickstart" covered only the platform REST API (curl register/login) and had no CLI path. | Added a "Kest CLI in 60 seconds" section at the top (English only). |
| 11 | Medium | The README sync instructions were outdated: they used the legacy flag and config key names (now `--workspace-id` and `platform_workspace_id`), the endpoint is under `/v1/workspaces/...`, and `--platform-token` is deprecated (the token is prompted for). | Fixed in `README.md` and `cli/README.md`. |
| 12 | Medium | `cli/AGENTS.md` said `go install github.com/kest-labs/kest/cmd/kest@latest`, but no `cmd/kest` package exists. | Replaced with the build-from-source command. |
| 13 | Medium | The docs say `curl ... install.sh \| sh`, but `install.sh` is a bash script (`[[ ]]`, `&>`). Where `sh` is dash (Debian/Ubuntu), `&>` runs the command in the background, so the `command -v` checks misbehave and the PATH hint never prints. | Changed to `\| bash` in the root README, `cli/README.md`, `cli/AGENTS.md` and the docs-site quickstart and CLI page. |
| 14 | Low | The init config contained a fake secret (`api_key: dev_key_123`). Its `ci` profile had `sync: true`, so `kest run --profile ci` failed in a new workspace that has no platform config. | Removed the fake secret. The template's `ci` profile now uses `sync: false`. `config.yaml` is written with mode 0600 (it later holds tokens). |
| 15 | Low | Users were not told that the agent workflow is the main use case. | The quickstarts now start with the 60-second path that ends in `claude mcp add kest -- kest mcp`. |

## Still open

| # | Severity | Friction | Suggested fix |
|---|----------|----------|---------------|
| A | P0 | The latest release (v0.7.7, installed by `install.sh`) has no `kest mcp`, `--json` or `kest import`. Release users cannot follow the agent quickstart. | Cut a release from this branch. Until then, the docs include a build-from-source note. Remove the note after the release. |
| B | Medium | `install.sh` has a Windows branch and the old README claimed Windows support, but GoReleaser builds only linux and darwin. `install.sh` calls the GitHub API without authentication (limit 60 requests/hour). When that fails, it falls back to `go install`, which requires Go and resolves the version from `/tags`, which may not match the latest release. | Make the script POSIX `sh` or keep documenting `bash`. Download `releases/latest/download/kest_<os>_<arch>.tar.gz` directly instead of calling the API. Drop the Windows branch or build Windows binaries. (Release logic was intentionally not changed here.) |
| C | Medium | `--max-time` also sets the HTTP client timeout, so a slow response is cut off and recorded as a transport timeout (status 0, no body). The "duration assertion failed" path, which keeps the response, is almost unreachable. | Use `max-time` plus a grace period as the client timeout, so the slow response is kept for `kest why`. |
| D | Medium | `kest replay <id>` of a record that failed an assertion re-sends it without the original assertions and reports success. | Store the assertions with the record and re-apply them on replay, or print a hint to pass `-a`. |
| E | Medium | `kest history` cannot tell an assertion failure apart from a pass (both show `200`). Only network errors show `ERR`. | Show a failure marker or column from `records.failure`. |
| F | Medium | `kest why` needs a separate OpenAI-compatible key, even when the caller is itself an LLM agent over MCP. | In `docs/mcp.md`, tell agents to read `kest_history` and the failing step's `response` and use `kest_why` only when a key is configured. |
| G | Medium | A profile or `KEST_ENV` naming an environment that is not in `config.yaml` silently leaves `base_url` empty, which leads to "unsupported protocol scheme". | Warn when the selected environment does not exist. |
| H | Medium | Nothing says which `.kest/` files to commit. `config.yaml` can hold `ai_key` and `platform_token` after `kest config set` or `kest sync config`. | Have `kest init` print a short "commit `flow/` and `flow.config.yaml`, not `config.yaml` secrets" note, or move secrets to the global config. |
| I | Low | Run output is noisy: absolute file paths in "Running N step(s) from ...", ANSI color codes even when stdout is not a TTY, each capture printed twice, lowercase methods in step headers, `00:00:00` for steps that never ran, and over-precise durations such as `3.344459ms` in `kest get`. | Shorten paths to relative, disable color when not a TTY or `NO_COLOR` is set, and print each capture once. |
| J | Low | `kest get` on a 4xx still prints `--- Debug Info ---` even when its assertions pass. | Show debug info only for failures or with `-v`. |
| K | Low | The top-level `kest --help` does not mention MCP or the agent workflow. Its tips mention Cursor/Windsurf log paths instead. | Add `kest mcp` and `kest init --base-url` to the help examples. |
| L | Low | The `docs-site/zh` quickstart and CLI page, `cli/GUIDE.md` and `cli/FAQ.md` still say `\| sh` and lack the 60-second path. | Mirror the English changes. |
