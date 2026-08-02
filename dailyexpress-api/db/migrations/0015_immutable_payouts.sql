-- Payouts become immutable single-attempt records.
-- Each payout row = exactly one transfer attempt; retries create NEW rows.
-- Removes the payout_attempt table, retry columns, and the per-trip unique
-- index (multiple payout rows per trip are now legal).

DROP INDEX payout_driver_trip_unique_idx;

DROP INDEX payout_status_retry_idx;

-- Drops the legacy payout_attempt audit rows (2 on prod at migration time).
DROP TABLE payout_attempt;

ALTER TABLE payout
  DROP COLUMN retry_count,
  DROP COLUMN next_retry_at;

-- Safe because no rows use 'permanent_failed' on prod.
UPDATE payout SET status = 'failed' WHERE status = 'permanent_failed';

-- NOTE: must run as standalone statements (NOT inside a transaction block).
-- Postgres 18.4 does not support ALTER TYPE ... DROP VALUE, so swap the type.
CREATE TYPE payout_status_new AS ENUM ('pending', 'processing', 'success', 'failed');

ALTER TABLE payout ALTER COLUMN status DROP DEFAULT;

ALTER TABLE payout ALTER COLUMN status TYPE payout_status_new USING status::text::payout_status_new;

ALTER TABLE payout ALTER COLUMN status SET DEFAULT 'processing'::payout_status_new;

DROP TYPE payout_status;

ALTER TYPE payout_status_new RENAME TO payout_status;
