#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_ROOT="$(dirname "$SCRIPT_DIR")"
BASE_URL="${KEST_BASE_URL:-http://127.0.0.1:8025}"
PROFILE="${KEST_PROFILE:-local}"
export KEST_BASE_URL="$BASE_URL"

if [[ "${KEST_SKIP_FLOWS:-}" == "1" ]]; then
  echo "Kest flow run skipped (KEST_SKIP_FLOWS=1)"
  exit 0
fi

HEALTH_URL="${KEST_HEALTH_URL:-${BASE_URL%/}/v1/health}"
echo "Checking API target: $HEALTH_URL"
if ! curl --fail --silent --show-error --max-time 5 "$HEALTH_URL" >/dev/null; then
  echo "API target is not reachable."
  echo "Start the API on $BASE_URL, set KEST_BASE_URL, or skip with KEST_SKIP_FLOWS=1."
  exit 1
fi

cd "$WORKSPACE_ROOT"
echo "Running Kest API flows with profile: $PROFILE"
RUN_ARGS=(run --profile "$PROFILE" --base-url "$BASE_URL")
if [[ "${KEST_SYNC_FLOWS:-}" == "1" ]]; then
  RUN_ARGS+=(--sync)
else
  RUN_ARGS+=(--sync=false)
fi

if [[ -n "${KEST_CLI_BIN:-}" ]]; then
  "$KEST_CLI_BIN" "${RUN_ARGS[@]}"
elif [[ -d "$WORKSPACE_ROOT/cli" ]]; then
  (cd "$WORKSPACE_ROOT/cli" && KEST_WORKSPACE_ROOT="$WORKSPACE_ROOT" go run . "${RUN_ARGS[@]}")
else
  kest "${RUN_ARGS[@]}"
fi
