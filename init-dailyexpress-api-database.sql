-- Create the app user used by dailyexpress-api.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'olaoluwa') THEN
    CREATE USER olaoluwa WITH PASSWORD 'ateazy';
  ELSE
    ALTER USER olaoluwa WITH PASSWORD 'ateazy';
  END IF;

  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'dailyexpress_readonly') THEN
    CREATE USER dailyexpress_readonly WITH PASSWORD 'dailyexpress_readonly_dev';
  ELSE
    ALTER USER dailyexpress_readonly WITH PASSWORD 'dailyexpress_readonly_dev';
  END IF;

  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'metabase_app') THEN
    CREATE USER metabase_app WITH PASSWORD 'metabase_app_dev';
  ELSE
    ALTER USER metabase_app WITH PASSWORD 'metabase_app_dev';
  END IF;
END
$$;

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
