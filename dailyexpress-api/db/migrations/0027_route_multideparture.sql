-- Route multi-departure + bidirectional boarding schema.
--
-- DESTRUCTIVE: existing route/trip/booking rows (and their dependent
-- earnings/payouts/payments/refunds) are removed. No backfill — data is
-- recreated against the new schema. Confirmed by owner 2026-09-10.
TRUNCATE TABLE "payout", "earning", "booking", "trip", "route" CASCADE;

-- Rename locations: pickup_location_* -> origin_*, dropoff_location_* -> destination_*,
-- intermediate_stops_* -> train_station_*
ALTER TABLE "route" RENAME COLUMN "pickup_location_title" TO "origin_title";
ALTER TABLE "route" RENAME COLUMN "pickup_location_locality" TO "origin_locality";
ALTER TABLE "route" RENAME COLUMN "pickup_location_label" TO "origin_label";
ALTER TABLE "route" RENAME COLUMN "dropoff_location_title" TO "destination_title";
ALTER TABLE "route" RENAME COLUMN "dropoff_location_locality" TO "destination_locality";
ALTER TABLE "route" RENAME COLUMN "dropoff_location_label" TO "destination_label";
ALTER TABLE "route" RENAME COLUMN "intermediate_stops_title" TO "train_station_title";
ALTER TABLE "route" RENAME COLUMN "intermediate_stops_locality" TO "train_station_locality";
ALTER TABLE "route" RENAME COLUMN "intermediate_stops_label" TO "train_station_label";

-- destination is now optional (e.g. FUNAAB routes end at the train station)
ALTER TABLE "route" ALTER COLUMN "destination_title" DROP NOT NULL;
ALTER TABLE "route" ALTER COLUMN "destination_locality" DROP NOT NULL;
ALTER TABLE "route" ALTER COLUMN "destination_label" DROP NOT NULL;

-- Drop old pricing/meeting point fields
ALTER TABLE "route" DROP COLUMN IF EXISTS "meeting_point";
ALTER TABLE "route" DROP COLUMN IF EXISTS "price_car";
ALTER TABLE "route" DROP COLUMN IF EXISTS "price_bus";

-- Add boarding points + uniform pricing
ALTER TABLE "route" ADD COLUMN "pickup_point" text NOT NULL;
ALTER TABLE "route" ADD COLUMN "dropoff_point" text NOT NULL;
ALTER TABLE "route" ADD COLUMN "price" bigint NOT NULL;
ALTER TABLE "route" ADD COLUMN "luggage_fee" bigint NOT NULL;

-- Departure/arrival become arrays of daily times (parallel by index)
ALTER TABLE "route" ALTER COLUMN "departure_time" TYPE time[] USING ARRAY["departure_time"];
ALTER TABLE "route" ALTER COLUMN "arrival_time" TYPE time[] USING ARRAY["arrival_time"];

-- Uniqueness: one route row per origin (all daily departures live on the row)
DROP INDEX IF EXISTS "route_origin_destination_departure_unique_idx";
DROP INDEX IF EXISTS "pickup_location_title_trgm_idx";
DROP INDEX IF EXISTS "pickup_location_locality_trgm_idx";
DROP INDEX IF EXISTS "pickup_location_label_trgm_idx";
DROP INDEX IF EXISTS "dropoff_location_title_trgm_idx";
DROP INDEX IF EXISTS "dropoff_location_locality_trgm_idx";
DROP INDEX IF EXISTS "dropoff_location_label_trgm_idx";
CREATE UNIQUE INDEX "route_origin_unique_idx" ON "route" ("origin_title", "origin_locality", "origin_label");

-- Trips target a concrete departure slot chosen from the route's arrays
ALTER TABLE "trip" ADD COLUMN "departure_time" time NOT NULL;
ALTER TABLE "trip" ADD COLUMN "arrival_time" time NOT NULL;
DROP INDEX IF EXISTS "trip_route_driver_date_unique_idx";
CREATE UNIQUE INDEX "trip_route_driver_date_departure_unique_idx"
  ON "trip" ("route_id", "driver_id", "date", "departure_time");

-- Bookings pin the chosen slot + boarding point + luggage count
ALTER TABLE "booking" ADD COLUMN "departure_time" time NOT NULL;
ALTER TABLE "booking" ADD COLUMN "arrival_time" time NOT NULL;
ALTER TABLE "booking" ADD COLUMN "boarding_point" text NOT NULL DEFAULT 'pickup';
ALTER TABLE "booking" ADD COLUMN "luggage_count" integer NOT NULL DEFAULT 0;
DROP INDEX IF EXISTS "booking_route_date_user_vehicletype_active_idx";
CREATE UNIQUE INDEX "booking_route_date_user_vehicletype_active_idx"
  ON "booking" ("route_id", "trip_date", "user_id", "vehicle_type", "departure_time")
  WHERE "status" IN ('pending', 'confirmed');

-- PRE-APPLY CHECK: intermediate migrations (0001-0017, 0020) were squashed and are
-- not on disk. Before running, confirm against the target DB that the column
-- (origin_*/destination_*/train_station_*, departure_time) and index names used
-- above match reality: `\d "route"`, `\d "trip"`, `\d "booking"`.
-- The trigram indexes dropped above were created outside drizzle and only exist
-- in the extracted snapshot.