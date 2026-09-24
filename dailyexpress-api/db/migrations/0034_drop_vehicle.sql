-- Remove the vehicle module completely. The `vehicle` table is dropped along
-- with the nullable `trip.vehicle_id` pointer (vehicle status was cleared on
-- trip completion; trip rows are otherwise untouched). The legacy `vehicle_type`
-- enum/columns were already removed in 0029.
--
-- Destructive only to vehicle data. Autocommit-per-statement, order matters
-- (FK constraint first). Apply via `railway connect Postgres`.

ALTER TABLE "trip" DROP CONSTRAINT IF EXISTS "trip_vehicle_id_vehicle_id_fk";
ALTER TABLE "trip" DROP COLUMN IF EXISTS "vehicle_id";
DROP TABLE IF EXISTS "vehicle";