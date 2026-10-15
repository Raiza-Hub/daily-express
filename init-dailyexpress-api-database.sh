#!/usr/bin/env bash
set -euo pipefail

: "${POSTGRES_USER:=postgres}"
: "${POSTGRES_DB:=postgres}"
: "${DAILYEXPRESS_API_DB_PASSWORD:?DAILYEXPRESS_API_DB_PASSWORD is required}"

psql \
  -v ON_ERROR_STOP=1 \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  -v dailyexpress_api_db_password="$DAILYEXPRESS_API_DB_PASSWORD" <<'EOSQL'
-- Create the app user used by dailyexpress-api.
SELECT format('CREATE USER olaoluwa WITH PASSWORD %L', :'dailyexpress_api_db_password')
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'olaoluwa')\gexec
SELECT format('ALTER USER olaoluwa WITH PASSWORD %L', :'dailyexpress_api_db_password')
WHERE EXISTS (SELECT FROM pg_roles WHERE rolname = 'olaoluwa')\gexec

-- Create the consolidated dailyexpress-api database.
SELECT 'CREATE DATABASE dailyexpress_api OWNER olaoluwa'
WHERE NOT EXISTS (
  SELECT FROM pg_database WHERE datname = 'dailyexpress_api'
)\gexec

\connect dailyexpress_api

-- Required for trigram indexes in the route schema.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

GRANT ALL ON DATABASE dailyexpress_api TO olaoluwa;
GRANT ALL ON SCHEMA public TO olaoluwa;
EOSQL
