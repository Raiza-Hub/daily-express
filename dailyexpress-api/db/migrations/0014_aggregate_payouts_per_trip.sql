-- Payouts become per-trip instead of per-earning.
-- One payout row covers all earnings (bookings) of a completed trip.

ALTER TABLE payout
  DROP CONSTRAINT payout_earning_id_earning_id_fk;

DROP INDEX payout_earning_id_unique_idx;

ALTER TABLE payout
  DROP COLUMN provider_transfer_code,
  DROP COLUMN provider_transfer_id,
  DROP COLUMN earnings_count,
  DROP COLUMN earning_id,
  ADD COLUMN trip_id uuid REFERENCES trip(id) ON DELETE RESTRICT;

CREATE UNIQUE INDEX payout_driver_trip_unique_idx
  ON payout (driver_id, trip_id) WHERE trip_id IS NOT NULL;

-- manual_review earning status is no longer used; failed payouts reset
-- earnings back to available for retry via re-completing the trip.
ALTER TABLE driver_stats DROP COLUMN in_review_payments;

-- NOTE: must run as a standalone statement (NOT inside a transaction block).
-- Safe because no rows use 'manual_review'.
ALTER TYPE earning_status DROP VALUE 'manual_review';
