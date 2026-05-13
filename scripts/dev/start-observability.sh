#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE=(docker compose -f docker-compose.observability.yml)

wait_for_postgres() {
  echo "Waiting for Postgres to become healthy..."
  for _ in {1..60}; do
    local db_container
    db_container="$("${COMPOSE[@]}" ps -q db 2>/dev/null || true)"
    if [ -n "$db_container" ] && [ "$(docker inspect -f '{{.State.Health.Status}}' "$db_container" 2>/dev/null || true)" = "healthy" ]; then
      echo "Postgres is ready."
      return
    fi

    sleep 1
  done

  echo "Postgres did not become healthy within 60 seconds."
  echo "Run 'docker compose -f docker-compose.observability.yml logs db' for details."
  exit 1
}

cd "$PROJECT_ROOT"

echo "Starting Postgres database..."
"${COMPOSE[@]}" up -d --remove-orphans db
wait_for_postgres

bash "$PROJECT_ROOT/scripts/dev/apply-observability-db-access.sh" --db-already-running

echo "Starting dailyexpress-api and Metabase..."
"${COMPOSE[@]}" up -d --remove-orphans dailyexpress-api metabase

cat <<'MSG'

Daily Express observability stack is starting.

URLs:
  Metabase: http://localhost:3002
  DailyExpress API: http://localhost:8000

Daily Express analytics datasource:
  Host: db
  Port: 5432
  Database: dailyexpress_api
  User: dailyexpress_readonly
  Password env/default: DAILYEXPRESS_READONLY_DB_PASSWORD / dailyexpress_readonly_dev

Metabase app database:
  Host: db
  Port: 5432
  Database: dailyexpress_metabase
  User: metabase_app

Use 'bun run observability:logs' to watch startup logs.
Use 'bun run observability:appsmith:up' when you want to build or use Appsmith action workflows.
MSG
