-- Migration: Split route into origin and destination (destructive)
-- This migration is destructive and consistent with 0027_route_multideparture.sql.
-- PRE-APPLY: check live column/index names via `\d trip` and `\d booking` in prod
-- Apply via: `railway connect Postgres` (autocommit per statement)

BEGIN;

-- 1. TRUNCATE dependent tables in FK order
TRUNCATE payout, earning, passenger, booking, trip, route CASCADE;

-- 2. Drop route_id columns from trip and booking
ALTER TABLE trip DROP COLUMN IF EXISTS route_id;
ALTER TABLE booking DROP COLUMN IF EXISTS route_id;

-- 3. Drop route table
DROP TABLE IF EXISTS route;

-- 4. Create origin table
CREATE TABLE IF NOT EXISTS origin (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  locality text NOT NULL,
  meeting_point text NOT NULL,
  departure_time time[] NOT NULL,
  price bigint NOT NULL,
  fee bigint NOT NULL,
  luggage_fee bigint NOT NULL,
  destination_ids uuid[] NOT NULL,
  status "status" NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

-- 5. Create destination table
CREATE TABLE IF NOT EXISTS destination (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  locality text NOT NULL,
  status "status" NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

-- 6. Unique indexes for origin and destination
CREATE UNIQUE INDEX IF NOT EXISTS origin_title_locality_unique_idx
  ON origin (title, locality);

CREATE UNIQUE INDEX IF NOT EXISTS destination_title_locality_unique_idx
  ON destination (title, locality);

-- 6b. Convert calendar days to date (Phase 15; folds in 0027's conversions)
ALTER TABLE trip ALTER COLUMN "date" TYPE date USING "date"::date;
ALTER TABLE booking ALTER COLUMN "trip_date" TYPE date USING "trip_date"::date;

-- 7. Add origin_id and destination_id to trip
ALTER TABLE trip
  ADD COLUMN IF NOT EXISTS origin_id uuid NOT NULL REFERENCES origin(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS destination_id uuid NOT NULL REFERENCES destination(id) ON DELETE RESTRICT,
  DROP COLUMN IF EXISTS arrival_time,
  DROP COLUMN IF EXISTS driver_claimed_at;

-- 8. Add origin_id and destination_id to booking
ALTER TABLE booking
  ADD COLUMN IF NOT EXISTS origin_id uuid NOT NULL REFERENCES origin(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS destination_id uuid NOT NULL REFERENCES destination(id) ON DELETE RESTRICT,
  DROP COLUMN IF EXISTS arrival_time,
  DROP COLUMN IF EXISTS boarding_point;

-- 9. Rebuild unique indexes for trip and booking
DROP INDEX IF EXISTS trip_route_driver_date_departure_unique_idx;
CREATE UNIQUE INDEX IF NOT EXISTS trip_origin_destination_driver_date_departure_unique_idx
  ON trip (origin_id, destination_id, driver_id, date, departure_time);

DROP INDEX IF EXISTS booking_route_date_user_active_idx;
CREATE UNIQUE INDEX IF NOT EXISTS booking_origin_destination_date_user_departure_active_idx
  ON booking (origin_id, destination_id, trip_date, user_id, departure_time)
  WHERE status IN ('pending', 'confirmed');

COMMIT;
