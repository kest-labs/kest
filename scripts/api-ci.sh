#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_ROOT="$(dirname "$SCRIPT_DIR")"
OUTPUT="${KEST_API_OUTPUT:-$WORKSPACE_ROOT/kest-api}"
BASE_URL="${KEST_BASE_URL:-http://127.0.0.1:5119}"

if [[ "${KEST_PLATFORM_URL:-}" == "" || "${KEST_PLATFORM_TOKEN:-}" == "" || "${KEST_PLATFORM_WORKSPACE_ID:-}" == "" ]]; then
  echo "Missing Kest Web sync config."
  echo "Set KEST_PLATFORM_URL, KEST_PLATFORM_TOKEN, and KEST_PLATFORM_WORKSPACE_ID."
  exit 1
fi

echo "Building Kest API"
cd "$WORKSPACE_ROOT/api"
go mod download
CGO_ENABLED="${CGO_ENABLED:-0}" go build -ldflags="-s -w" -o "$OUTPUT" ./cmd/api

HEALTH_URL="${KEST_HEALTH_URL:-${BASE_URL%/}/v1/health}"
echo "Checking API target: $HEALTH_URL"
if ! curl --fail --silent --show-error --max-time 10 "$HEALTH_URL" >/dev/null; then
  echo "API target is not reachable. Start the API or set KEST_BASE_URL."
  exit 1
fi

cd "$WORKSPACE_ROOT"
echo "Running Kest API flows in CI"
if [[ -n "${KEST_CLI_BIN:-}" ]]; then
  "$KEST_CLI_BIN" run --profile ci --sync
elif [[ -d "$WORKSPACE_ROOT/cli" ]]; then
  (cd "$WORKSPACE_ROOT/cli" && go run . run --profile ci --sync)
else
  kest run --profile ci --sync
fi
