-- Migration: collapse booking_status to ('pending', 'confirmed')
--
-- trip.status is the single authority for cancellation. Nothing writes
-- booking.status = 'cancelled' any more: TripCancellationService no longer
-- flips booking rows, so a booking on a cancelled trip stays 'confirmed' and
-- the trip's status is what reflects the cancellation.
--
-- Migration 0041 added 'cancelled' purely so a query literal would parse --
-- its own header records that "Nothing writes this value yet". Both read
-- paths that accepted it (getUserBookings, findTripPassengersForTrip) now
-- filter on 'confirmed' only, so the value is unreferenced and is dropped.
--
-- Normalise existing rows first: any 'cancelled' booking becomes 'confirmed'.
--
-- ORDERING: this MUST be applied after 0040_trip_dispatch.sql and
-- 0041_booking_status_cancelled.sql. Both contain
--   ALTER TYPE "booking_status" ADD VALUE IF NOT EXISTS 'cancelled';
-- If either is applied after this type-swap it will re-add the value.
--
-- Postgres cannot DROP VALUE from an enum (see notes on 0014/0015), so the
-- type is swapped: create the 2-value type, cast the column through text,
-- then drop and rename.
--
-- Apply via `railway connect Postgres` (autocommit per statement).

UPDATE "booking" SET "status" = 'confirmed' WHERE "status" = 'cancelled';

ALTER TABLE "booking" ALTER COLUMN "status" DROP DEFAULT;

CREATE TYPE "booking_status_new" AS ENUM ('pending', 'confirmed');

ALTER TABLE "booking"
  ALTER COLUMN "status" TYPE "booking_status_new"
  USING "status"::text::"booking_status_new";

ALTER TABLE "booking"
  ALTER COLUMN "status" SET DEFAULT 'pending'::"booking_status_new";

DROP TYPE "booking_status";

ALTER TYPE "booking_status_new" RENAME TO "booking_status";
