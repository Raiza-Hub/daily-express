-- One active (non-failed) payout per trip.
--
-- Retries are implemented as NEW payout rows per trip: a `failed` row drops out
-- of this partial unique index automatically, so trip re-completion can insert a
-- fresh retry row, and multiple `failed` rows accumulate freely.
--
-- `insertPayout` relies on ON CONFLICT DO NOTHING against this index to dedupe
-- two near-simultaneous completeTrip requests deterministically (the second
-- insert sees the winner's row and returns no rows).
--
-- Legacy payout rows (trip_id NULL) are excluded via the predicate.
--
-- NOTE: requires migration 0027 (which TRUNCATEs the payout table) to have run,
-- or an existing payout table with no duplicate non-failed rows per trip,
-- otherwise the CREATE UNIQUE INDEX fails on existing data.

CREATE UNIQUE INDEX "payout_trip_active_unique_idx"
  ON "payout" ("trip_id")
  WHERE "trip_id" IS NOT NULL AND "status" <> 'failed';