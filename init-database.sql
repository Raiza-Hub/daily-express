-- -- Create databases
-- CREATE DATABASE "dailyExpress_auth";
-- CREATE DATABASE "dailyExpress_users";
-- CREATE DATABASE "dailyExpress_drivers";
-- CREATE DATABASE "dailyExpress_payment";
-- CREATE DATABASE "dailyExpress_route";
-- CREATE DATABASE "dailyExpress_schedule";

-- -- Create the user first
-- CREATE USER olaoluwa WITH PASSWORD 'ateazy';

-- -- Grant permissions
-- GRANT ALL ON SCHEMA public TO olaoluwa;
-- ALTER SCHEMA public OWNER TO olaoluwa;
-- GRANT ALL PRIVILEGES ON DATABASE "dailyExpress_auth" TO olaoluwa;
-- GRANT ALL PRIVILEGES ON DATABASE "dailyExpress_users" TO olaoluwa;
-- GRANT ALL PRIVILEGES ON DATABASE "dailyExpress_drivers" TO olaoluwa;
-- GRANT ALL PRIVILEGES ON DATABASE "dailyExpress_payment" TO olaoluwa;
-- GRANT ALL PRIVILEGES ON DATABASE "dailyExpress_route" TO olaoluwa;
-- GRANT ALL PRIVILEGES ON DATABASE "dailyExpress_schedule" TO olaoluwa;

-- 1. Create the user first
CREATE USER olaoluwa WITH PASSWORD 'ateazy';

-- 2. Create databases and assign 'olaoluwa' as the OWNER immediately
CREATE DATABASE "dailyExpress_auth" OWNER olaoluwa;
CREATE DATABASE "dailyExpress_users" OWNER olaoluwa;
CREATE DATABASE "dailyExpress_drivers" OWNER olaoluwa;
CREATE DATABASE "dailyExpress_payment" OWNER olaoluwa;
CREATE DATABASE "dailyExpress_route" OWNER olaoluwa;
CREATE DATABASE "dailyExpress_schedule" OWNER olaoluwa;