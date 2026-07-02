#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PIDS=()
STOPPING=false

if [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ]; then
  echo "Usage: bun run dev:full"
  echo ""
  echo "Starts Postgres in Docker, then runs dailyexpress-api, apps/web, and apps/drivers locally."
  exit 0
fi

cleanup() {
  if [ "$STOPPING" = true ]; then
    return
  fi

  STOPPING=true
  if [ "${#PIDS[@]}" -gt 0 ]; then
    echo ""
    echo "Stopping Daily Express dev processes..."
    for pid in "${PIDS[@]}"; do
      kill "$pid" 2>/dev/null || true
    done
    for pid in "${PIDS[@]}"; do
      wait "$pid" 2>/dev/null || true
    done
  fi
}

start_service() {
  local name="$1"
  local directory="$2"
  shift 2

  echo "Starting ${name}..."
  (
    cd "$directory"
    exec "$@"
  ) &
  PIDS+=("$!")
}

start_database() {
  if ! docker info >/dev/null 2>&1; then
    echo "Docker is not running or is not reachable."
    echo "Start Docker Desktop, then run 'bun run dev:full' again."
    exit 1
  fi

  echo "Starting Postgres database..."
  docker compose \
    --env-file "$PROJECT_ROOT/.env" \
    -f "$PROJECT_ROOT/docker-compose.observability.yml" \
    up -d --remove-orphans db

  echo "Waiting for Postgres to become healthy..."
  for _ in {1..60}; do
    if [ "$(docker inspect -f '{{.State.Health.Status}}' daily_express 2>/dev/null || true)" = "healthy" ]; then
      echo "Postgres is ready."
      return
    fi

    sleep 1
  done

  echo "Postgres did not become healthy within 60 seconds."
  echo "Run 'docker compose -f docker-compose.observability.yml logs db' for details."
  exit 1
}

trap cleanup EXIT
trap 'cleanup; exit 130' INT TERM

echo "=========================================="
echo "  Daily Express - Full Development Setup"
echo "=========================================="
echo ""

start_database

echo "[2/3] Starting backend..."
start_service "dailyexpress-api" "$PROJECT_ROOT/dailyexpress-api" bun run dev

echo "[3/3] Starting frontend apps..."
start_service "web frontend" "$PROJECT_ROOT/apps/web" bun run dev
start_service "driver frontend" "$PROJECT_ROOT/apps/drivers" bun run dev

DOCS_AVAILABLE=false
if [ -d "$PROJECT_ROOT/apps/docs" ]; then
  DOCS_AVAILABLE=true
  start_service "docs" "$PROJECT_ROOT/apps/docs" bun run dev
fi

echo ""
echo "=========================================="
echo "  All services started!"
echo "=========================================="
echo ""
echo "URLs:"
echo "  Web Frontend:     http://localhost:3000"
echo "  Driver App:      http://localhost:3001"
if [ "$DOCS_AVAILABLE" = true ]; then
  echo "  Docs:            http://localhost:3012"
else
  echo "  Docs:            (not configured in this workspace)"
fi
echo "  DailyExpress API: http://localhost:8000"
echo "  Postgres:         localhost:5432"
echo ""
echo "Press Ctrl+C to stop all processes"
echo ""

while true; do
  for pid in "${PIDS[@]}"; do
    if ! kill -0 "$pid" 2>/dev/null; then
      set +e
      wait "$pid"
      status="$?"
      set -e
      exit "$status"
    fi
  done
  sleep 1
done
