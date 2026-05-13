#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE=(docker compose -f docker-compose.observability.yml)

: "${DAILYEXPRESS_API_DB_PASSWORD:?DAILYEXPRESS_API_DB_PASSWORD is required}"
: "${DAILYEXPRESS_READONLY_DB_PASSWORD:?DAILYEXPRESS_READONLY_DB_PASSWORD is required}"
: "${METABASE_APP_DB_PASSWORD:?METABASE_APP_DB_PASSWORD is required}"

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

if [ "${1:-}" != "--db-already-running" ]; then
  echo "Starting Postgres database..."
  "${COMPOSE[@]}" up -d --remove-orphans db
fi

wait_for_postgres

echo "Applying observability database roles and grants..."
"${COMPOSE[@]}" exec -T \
  -e POSTGRES_USER="${POSTGRES_USER:-postgres}" \
  -e POSTGRES_DB="${POSTGRES_DB:-postgres}" \
  -e DAILYEXPRESS_API_DB_PASSWORD="$DAILYEXPRESS_API_DB_PASSWORD" \
  -e DAILYEXPRESS_READONLY_DB_PASSWORD="$DAILYEXPRESS_READONLY_DB_PASSWORD" \
  -e METABASE_APP_DB_PASSWORD="$METABASE_APP_DB_PASSWORD" \
  db bash /docker-entrypoint-initdb.d/init-dailyexpress-api-database.sh

echo "Observability database access is ready."
