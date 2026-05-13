#!/usr/bin/env bash
set -euo pipefail

: "${POSTGRES_USER:=postgres}"
: "${POSTGRES_DB:=postgres}"
: "${DAILYEXPRESS_API_DB_PASSWORD:?DAILYEXPRESS_API_DB_PASSWORD is required}"
: "${DAILYEXPRESS_READONLY_DB_PASSWORD:?DAILYEXPRESS_READONLY_DB_PASSWORD is required}"
: "${METABASE_APP_DB_PASSWORD:?METABASE_APP_DB_PASSWORD is required}"

psql \
  -v ON_ERROR_STOP=1 \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  -v dailyexpress_api_db_password="$DAILYEXPRESS_API_DB_PASSWORD" \
  -v dailyexpress_readonly_db_password="$DAILYEXPRESS_READONLY_DB_PASSWORD" \
  -v metabase_app_db_password="$METABASE_APP_DB_PASSWORD" <<'EOSQL'
-- Create the app user used by dailyexpress-api.
SELECT format('CREATE USER olaoluwa WITH PASSWORD %L', :'dailyexpress_api_db_password')
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'olaoluwa')\gexec
SELECT format('ALTER USER olaoluwa WITH PASSWORD %L', :'dailyexpress_api_db_password')
WHERE EXISTS (SELECT FROM pg_roles WHERE rolname = 'olaoluwa')\gexec

SELECT format('CREATE USER dailyexpress_readonly WITH PASSWORD %L', :'dailyexpress_readonly_db_password')
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'dailyexpress_readonly')\gexec
SELECT format('ALTER USER dailyexpress_readonly WITH PASSWORD %L', :'dailyexpress_readonly_db_password')
WHERE EXISTS (SELECT FROM pg_roles WHERE rolname = 'dailyexpress_readonly')\gexec

SELECT format('CREATE USER metabase_app WITH PASSWORD %L', :'metabase_app_db_password')
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'metabase_app')\gexec
SELECT format('ALTER USER metabase_app WITH PASSWORD %L', :'metabase_app_db_password')
WHERE EXISTS (SELECT FROM pg_roles WHERE rolname = 'metabase_app')\gexec

-- Create the consolidated dailyexpress-api database.
SELECT 'CREATE DATABASE dailyexpress_api OWNER olaoluwa'
WHERE NOT EXISTS (
  SELECT FROM pg_database WHERE datname = 'dailyexpress_api'
)\gexec

-- Create the Metabase application database for saved dashboards/settings.
SELECT 'CREATE DATABASE dailyexpress_metabase OWNER metabase_app'
WHERE NOT EXISTS (
  SELECT FROM pg_database WHERE datname = 'dailyexpress_metabase'
)\gexec

ALTER DATABASE dailyexpress_metabase OWNER TO metabase_app;
GRANT ALL PRIVILEGES ON DATABASE dailyexpress_metabase TO metabase_app;
GRANT CONNECT ON DATABASE dailyexpress_api TO dailyexpress_readonly;

\connect dailyexpress_api

-- Required for trigram indexes in the route schema.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

GRANT ALL ON DATABASE dailyexpress_api TO olaoluwa;
GRANT ALL ON SCHEMA public TO olaoluwa;
GRANT USAGE ON SCHEMA public TO dailyexpress_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO dailyexpress_readonly;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO dailyexpress_readonly;
ALTER DEFAULT PRIVILEGES FOR ROLE olaoluwa IN SCHEMA public
  GRANT SELECT ON TABLES TO dailyexpress_readonly;
ALTER DEFAULT PRIVILEGES FOR ROLE olaoluwa IN SCHEMA public
  GRANT SELECT ON SEQUENCES TO dailyexpress_readonly;
EOSQL
