-- Split booking.status off trip_status into a dedicated booking_status enum, and
-- trim trip_status to the values trips actually take.
--
-- booking_status: ('pending', 'confirmed') — a booking is created 'pending' at
-- checkout and becomes 'confirmed' by the Kora charge.success webhook. It never
-- takes a trip lifecycle value.
--
-- trip_status: ('cancelled', 'completed', 'awaiting_driver') — trips are created
-- 'awaiting_driver' (driverId is always NULL today) and only ever move to
-- 'completed'. 'pending' and 'confirmed' were never written.
--
-- 'completed' is REMOVED from booking.status. The driver "complete trip" write
-- that flipped confirmed -> completed on every booking of the trip is dropped;
-- trip completion is a trip-level fact, and earnings/payout already key off
-- trip.completedAt.
--
-- Non-destructive: no rows are deleted. Both enums are rebuilt via type swap
-- because PostgreSQL does not implement `ALTER TYPE ... DROP VALUE`.
-- Apply via `railway connect Postgres` (autocommit per statement).

-- ---------------------------------------------------------------------------
-- booking_status
-- ---------------------------------------------------------------------------

CREATE TYPE booking_status AS ENUM ('pending', 'confirmed');

-- Normalise legacy rows BEFORE the cast. Without this, any booking still
-- holding a trip-only value ('completed' / 'cancelled' / 'awaiting_driver')
-- makes the `USING status::text::booking_status` conversion fail outright.
UPDATE booking SET status = 'confirmed'
WHERE status IN ('completed', 'cancelled', 'awaiting_driver');

-- The partial unique index predicate is cast to trip_status ('pending' /
-- 'confirmed'), so it must be dropped before the column type changes or the
-- swap fails with "operator does not exist: booking_status = trip_status".
--
-- The predicate is redundant anyway: booking_status is exactly
-- ('pending', 'confirmed'), so the index now covers every row. Recreated
-- below as a plain unique index, renamed to drop the "active" qualifier that
-- no longer describes it.
DROP INDEX IF EXISTS booking_origin_destination_date_user_departure_active_idx;

ALTER TABLE booking ALTER COLUMN status DROP DEFAULT;
ALTER TABLE booking
  ALTER COLUMN status TYPE booking_status USING status::text::booking_status;
ALTER TABLE booking
  ALTER COLUMN status SET DEFAULT 'pending'::booking_status;

CREATE UNIQUE INDEX booking_origin_destination_date_user_departure_idx
  ON booking (origin_id, destination_id, trip_date, user_id, departure_time);

-- ---------------------------------------------------------------------------
-- trip_status
-- ---------------------------------------------------------------------------

CREATE TYPE trip_status_new AS ENUM ('cancelled', 'completed', 'awaiting_driver');

-- Normalise legacy rows BEFORE the cast, same reason as booking_status above.
-- 'pending' / 'confirmed' are not in trip_status_new, so a single surviving row
-- would abort the conversion. No current code path writes either value, so any
-- hit here is legacy: an undispatched trip is 'awaiting_driver'.
UPDATE trip SET status = 'awaiting_driver'
WHERE status IN ('pending', 'confirmed');

ALTER TABLE trip ALTER COLUMN status DROP DEFAULT;
ALTER TABLE trip
  ALTER COLUMN status TYPE trip_status_new USING status::text::trip_status_new;
ALTER TABLE trip
  ALTER COLUMN status SET DEFAULT 'awaiting_driver'::trip_status_new;

DROP TYPE trip_status;
ALTER TYPE trip_status_new RENAME TO trip_status;