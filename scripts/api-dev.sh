#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_ROOT="$(dirname "$SCRIPT_DIR")"

PORT="${PORT:-5119}"
BASE_URL="${KEST_BASE_URL:-http://127.0.0.1:$PORT}"
DB_NAME="${DB_NAME:-kest}"
DB_USERNAME="${DB_USERNAME:-kest_user}"
DB_PASSWORD="${DB_PASSWORD:-kest_password_123}"
JWT_SECRET="${JWT_SECRET:-your_jwt_secret_key_min_32_characters_change_in_production}"

echo "Starting Kest API locally"

if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  if docker ps --format '{{.Names}}' | grep -qx 'kest-postgres'; then
    echo "PostgreSQL is already running"
  elif docker ps -a --format '{{.Names}}' | grep -qx 'kest-postgres'; then
    echo "Starting existing PostgreSQL container"
    docker start kest-postgres >/dev/null
  else
    echo "Creating PostgreSQL container"
    docker run -d \
      --name kest-postgres \
      -e POSTGRES_USER="$DB_USERNAME" \
      -e POSTGRES_PASSWORD="$DB_PASSWORD" \
      -e POSTGRES_DB="$DB_NAME" \
      -p 5432:5432 \
      postgres:14-alpine >/dev/null
  fi
else
  echo "Docker is not installed. PostgreSQL must already be running on localhost:5432."
fi

echo "Waiting for PostgreSQL..."
for _ in $(seq 1 30); do
  if (echo >/dev/tcp/127.0.0.1/5432) >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if ! (echo >/dev/tcp/127.0.0.1/5432) >/dev/null 2>&1; then
  echo "PostgreSQL is not reachable on localhost:5432."
  echo "Start Docker Desktop, or start PostgreSQL manually, then run this command again."
  exit 1
fi

cd "$WORKSPACE_ROOT/api"

echo "Starting API on $BASE_URL"
(
  DB_HOST="${DB_HOST:-localhost}" \
  DB_PORT="${DB_PORT:-5432}" \
  DB_NAME="$DB_NAME" \
  DB_USERNAME="$DB_USERNAME" \
  DB_PASSWORD="$DB_PASSWORD" \
  JWT_SECRET="$JWT_SECRET" \
  PORT="$PORT" \
  GIN_MODE="${GIN_MODE:-debug}" \
  go run ./cmd/api
) &
API_PID=$!

cleanup() {
  if kill -0 "$API_PID" >/dev/null 2>&1; then
    kill "$API_PID" >/dev/null 2>&1 || true
    wait "$API_PID" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT INT TERM

HEALTH_URL="${BASE_URL%/}/v1/health"
echo "Waiting for API health: $HEALTH_URL"
for _ in $(seq 1 60); do
  if curl --fail --silent --show-error --max-time 2 "$HEALTH_URL" >/dev/null 2>&1; then
    echo "API is ready"
    KEST_BASE_URL="$BASE_URL" "$WORKSPACE_ROOT/scripts/api-test.sh"
    echo "API flow test completed"
    if [[ "${KEST_KEEP_API:-}" == "1" ]]; then
      echo "API is still running. Press Ctrl+C to stop."
      wait "$API_PID"
      exit $?
    fi
    exit 0
  fi
  if ! kill -0 "$API_PID" >/dev/null 2>&1; then
    echo "API process exited before becoming ready"
    wait "$API_PID"
    exit $?
  fi
  sleep 1
done

echo "API did not become ready in time"
exit 1
