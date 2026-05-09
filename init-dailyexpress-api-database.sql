-- Create the app user used by dailyexpress-api.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'olaoluwa') THEN
    CREATE USER olaoluwa WITH PASSWORD 'ateazy';
  ELSE
    ALTER USER olaoluwa WITH PASSWORD 'ateazy';
  END IF;
END
$$;

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
