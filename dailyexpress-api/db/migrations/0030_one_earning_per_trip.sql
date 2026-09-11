-- One earning row per trip (pool): drop booking_id, make driver_id nullable
-- (trip may not have a driver yet at confirmation), unique constraint on trip_id.
--
-- earning.booking_id_unique was the old constraint name (inline .unique() on column).
-- earning_trip_unique_idx replaces it.

DROP INDEX IF EXISTS "earning_booking_id_unique";
ALTER TABLE "earning" DROP COLUMN IF EXISTS "booking_id";
ALTER TABLE "earning" ALTER COLUMN "driver_id" DROP NOT NULL;
CREATE UNIQUE INDEX "earning_trip_unique_idx" ON "earning" ("trip_id");