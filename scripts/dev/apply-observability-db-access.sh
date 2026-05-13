#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE=(docker compose -f docker-compose.observability.yml)

READONLY_PASSWORD="${DAILYEXPRESS_READONLY_DB_PASSWORD:-dailyexpress_readonly_dev}"
METABASE_PASSWORD="${METABASE_APP_DB_PASSWORD:-metabase_app_dev}"

sql_escape() {
  printf "%s" "$1" | sed "s/'/''/g"
}

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
  wait_for_postgres
fi

echo "Applying observability database roles and grants..."
"${COMPOSE[@]}" exec -T db psql \
  -v ON_ERROR_STOP=1 \
  -U postgres \
  -d postgres \
  -f /docker-entrypoint-initdb.d/init-dailyexpress-api-database.sql

readonly_password_sql="$(sql_escape "$READONLY_PASSWORD")"
metabase_password_sql="$(sql_escape "$METABASE_PASSWORD")"

"${COMPOSE[@]}" exec -T db psql \
  -v ON_ERROR_STOP=1 \
  -U postgres \
  -d postgres \
  -c "ALTER ROLE dailyexpress_readonly WITH PASSWORD '${readonly_password_sql}'; ALTER ROLE metabase_app WITH PASSWORD '${metabase_password_sql}';"

echo "Observability database access is ready."
