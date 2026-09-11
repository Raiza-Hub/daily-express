-- Drop columns from booking: seat_count, phone, vehicle_type, first_name, last_name, fare_amount, fee_amount.
-- All derived from or superseded by the passenger table and route-level defaults.
--
-- seat_count    → derived from passenger table COUNT(*)
-- phone         → on passenger table (travelers); booker contact via users table
-- vehicle_type  → always 'car'; trip capacity is fixed at 4
-- first_name / last_name → on passenger table; booker name via users table
-- fare_amount / fee_amount → replaced by precomputed total_amount + total_fee
--
-- Add total_amount/total_fee: aggregated (precomputed at booking creation) values.
--   total_amount = fare x passengerCount + luggageCount x luggage_fee (driver earning)
--   total_fee     = fee x passengerCount (platform fee)

DROP INDEX IF EXISTS "booking_route_date_user_vehicletype_active_idx";

ALTER TABLE "booking" DROP COLUMN IF EXISTS "seat_count";
ALTER TABLE "booking" DROP COLUMN IF EXISTS "phone";
ALTER TABLE "booking" DROP COLUMN IF EXISTS "vehicle_type";
ALTER TABLE "booking" DROP COLUMN IF EXISTS "first_name";
ALTER TABLE "booking" DROP COLUMN IF EXISTS "last_name";
ALTER TABLE "booking" DROP COLUMN IF EXISTS "fare_amount";
ALTER TABLE "booking" DROP COLUMN IF EXISTS "fee_amount";

ALTER TABLE "booking" ADD COLUMN "total_amount" bigint NOT NULL DEFAULT 0;
ALTER TABLE "booking" ADD COLUMN "total_fee" bigint NOT NULL DEFAULT 0;

-- Recreate dedupe index without vehicle_type
CREATE UNIQUE INDEX "booking_route_date_user_active_idx"
  ON "booking" ("route_id", "trip_date", "user_id", "departure_time")
  WHERE status IN ('pending', 'confirmed');

-- Drop vehicle_type from trip: capacity is always TRIP_CAPACITY (4), always 'car'
ALTER TABLE "trip" DROP COLUMN IF EXISTS "vehicle_type";

-- Drop vehicle_type from vehicle: only make/model/plate/color/capacity remain
ALTER TABLE "vehicle" DROP COLUMN IF EXISTS "vehicle_type";
DROP TYPE IF EXISTS "vehicle_type";