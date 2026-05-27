# Kest Web-Centered Flow Automation

## Product Logic

Kest Web is the source of truth for workspace flow testing assets and results.

- Developers push application code to GitHub.
- Testers create, import, edit, and enable `.flow.md` definitions in Kest Web.
- Workspace members view flow definitions, visual graphs, run history, step logs, and Kest logs in Kest Web.
- Test machines use Kest CLI with a workspace CLI key to run Web-managed flows and sync results back to Kest Web.
- Server CI uses the same Web-managed flows after build completion and syncs `server_ci` results back to Kest Web.

GitHub is not required to store flow definitions. The repository can still contain helper scripts and app code, but runnable flow content lives in Kest Web.

## Roles

| Role | Responsibility |
| --- | --- |
| Developer | Push app code and keep build pipelines healthy. |
| Tester | Manage `.flow.md` content in Kest Web and review failures. |
| Kest Web | Store flow definitions, visual graph state, run history, step logs, and Kest logs. |
| Test machine CLI | Pull enabled workspace flows, run them locally, and sync `test_machine` results. |
| Server CI CLI | Pull enabled workspace flows after build, run them on the deployed target, and sync `server_ci` results. |

## Kest Web Setup

1. Create a workspace CLI key with flow scopes:
   - `flow:run` for pulling runnable flows and syncing run results.
   - `flow:write` only if the CLI must upload flow definitions.
2. In the Flow page, import or edit `.flow.md` content.
3. Enable flows that should run on test machines and CI.
4. Use the visual graph and parse status to confirm the Markdown was parsed.

## Test Machine CLI

Configure the local test machine once:

```bash
kest key "kest_key_..."
```

Run all enabled Web-managed flows and sync results:

```bash
kest run --workspace-flow all --runner-type test_machine --sync
```

Run one flow by Web flow id, source id, source path, or name:

```bash
kest run --workspace-flow auth-flow --runner-type test_machine --sync
```

## Server CI

After the server build/deploy step succeeds, call the Kest Web CI webhook with the workspace CLI token:

```bash
curl -X POST "$KEST_PLATFORM_URL/workspaces/$KEST_PLATFORM_WORKSPACE_ID/cli/ci/webhook" \
  -H "Authorization: Bearer $KEST_PLATFORM_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "event_id": "'"$GITHUB_RUN_ID"'",
    "provider": "github",
    "ref": "'"$GITHUB_REF"'",
    "commit_sha": "'"$GITHUB_SHA"'",
    "profile": "ci",
    "base_url": "'"$STAGING_BASE_URL"'"
  }'
```

Then run the command returned by the webhook, or call the equivalent CLI command directly:

```bash
kest run --workspace-flow all --runner-type server_ci --profile ci --base-url "$STAGING_BASE_URL" --sync
```

## Result Storage

Kest Web stores:

- `.flow.md` raw content, hash, revision, enabled state, source path, parse status, and parse error.
- Parsed flow graph steps and edges for visualization.
- Run status, runner type, profile, environment, base URL, duration, and failure message.
- Step request/response/assert logs.
- Sanitized Kest session log content, excerpt, source path, and truncation state.

Run history can be filtered by runner type, status, source, profile, and time range.

## Acceptance Checks

- Import `.flow.md` in Kest Web and confirm parse status is successful.
- Confirm the visual graph is generated from the Markdown.
- Run `kest run --workspace-flow all --runner-type test_machine --sync` from a test machine.
- Confirm `test_machine` results and logs appear in Kest Web.
- Trigger the CI webhook after a server build.
- Run `kest run --workspace-flow all --runner-type server_ci --sync` in CI.
- Confirm `server_ci` results and logs appear in Kest Web.
