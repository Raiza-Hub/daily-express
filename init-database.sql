-- 1. Create the user first
CREATE USER olaoluwa WITH PASSWORD 'ateazy';

-- 2. Create databases
CREATE DATABASE "dailyExpress_auth" OWNER olaoluwa;
CREATE DATABASE "dailyExpress_drivers" OWNER olaoluwa;
CREATE DATABASE "dailyExpress_payment" OWNER olaoluwa;
CREATE DATABASE "dailyExpress_route" OWNER olaoluwa;
CREATE DATABASE "dailyExpress_notifications" OWNER olaoluwa;
CREATE DATABASE "dailyExpress_payout" OWNER olaoluwa;

-- 2. Enable pg_trgm extension on route database (required for trigram indexes)
\c dailyExpress_route
CREATE EXTENSION IF NOT EXISTS pg_trgm;