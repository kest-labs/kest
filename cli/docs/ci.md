# Running Kest in CI

Kest flows double as API regression tests. In CI you usually want three
things: a non-zero exit code when the API misbehaves, a test report the CI
system understands (JUnit XML), and a machine-readable result for bots and
agents (`--json`).

```bash
kest run tests/ --json --junit kest-results/junit.xml > kest-results/result.json
```

- `--junit <path>` writes a JUnit XML report built from the same result as
  `--json` (alias of `--report-junit`). One `<testsuite>` per flow file, one
  `<testcase>` per step. Assertion and snapshot failures are `<failure>`
  elements; network, timeout, exec and config problems are `<error>` elements.
  Failure text contains the failed assertions, the response status, a redacted
  response body excerpt and the `kest show <id>` hint.
- The JUnit file is written even when the run cannot start (unknown profile,
  missing flow file), so CI never silently reports "no tests".
- `--json` prints exactly one JSON document to stdout; see
  [json-output.md](json-output.md).
- Exit codes: `0` pass, `1` assertion failure, `2` runtime error (network,
  timeout, exec), `3` usage/config error.

The `ci` profile in `.kest/flow.config.yaml` can set the report paths so you do
not have to pass them on every run (`reports.junit`, `reports.json`).

## GitHub Actions

The repository ships a composite action at
[`.github/actions/kest-run`](../../.github/actions/kest-run/action.yml). It
installs Kest, runs your flows with `--json --junit`, writes a Markdown job
summary (pass/fail counts, a table of failed steps and assertions), and fails
the job when Kest fails.

```yaml
name: API tests

on: [push, pull_request]

jobs:
  kest:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Start API
        run: |
          ./scripts/start-api.sh &
          for i in $(seq 1 60); do curl -fs http://127.0.0.1:8080/health && break; sleep 1; done

      - name: Run Kest flows
        id: kest
        uses: kest-labs/kest/.github/actions/kest-run@main
        with:
          flows: |
            tests/auth.flow.md
            tests/items/
          base-url: http://127.0.0.1:8080
          vars: |
            admin_password=${{ secrets.ADMIN_PASSWORD }}

      - name: Upload Kest results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: kest-results
          path: kest-results/
```

### Inputs

| Input               | Default                    | Description                                                                 |
| ------------------- | -------------------------- | --------------------------------------------------------------------------- |
| `flows`             | _(profile include)_        | Flow files, directories or globs, whitespace or newline separated           |
| `env`               |                            | Kest environment (`--env`)                                                  |
| `base-url`          |                            | Base URL override (`--base-url`)                                            |
| `vars`              |                            | Newline-separated `key=value` pairs (`--var`)                               |
| `args`              |                            | Extra `kest run` arguments, e.g. `--fail-fast --profile ci`                 |
| `kest-version`      | `latest`                   | `latest` (newest release via `install.sh`), a tag like `v1.4.0`, or `source` |
| `working-directory` | `.`                        | Directory to run in (Kest workspace root)                                   |
| `json-path`         | `kest-results/result.json` | JSON result location                                                        |
| `junit-path`        | `kest-results/junit.xml`   | JUnit report location                                                       |
| `fail-on-error`     | `true`                     | Fail the step when Kest exits non-zero                                      |

### Outputs

`exit-code`, `passed`, `failed`, `json-path`, `junit-path`.

### Installing Kest

- `latest` runs the repository `install.sh`, which downloads the newest
  GitHub release (Linux/macOS, amd64/arm64) and falls back to `go install`.
- A version tag downloads that release archive, falling back to
  `go install github.com/kest-labs/kest/cli@<tag>` when Go is available.
- `source` builds the CLI from the action's own checkout; add
  `actions/setup-go` first. Use this to test unreleased CLI changes.

`--json` and `--junit` require a Kest release that includes them. Until such a
release is published, use `kest-version: source`.

### Other CI systems

Any CI that understands JUnit XML works the same way:

```bash
curl -fsSL https://kest.dev/install.sh | sh
kest run tests/ --json --junit reports/kest-junit.xml > reports/kest.json
```

GitLab CI example:

```yaml
kest:
  script:
    - curl -fsSL https://kest.dev/install.sh | sh
    - kest run tests/ --json --junit kest-junit.xml > kest.json
  artifacts:
    when: always
    reports:
      junit: kest-junit.xml
    paths: [kest.json]
```
