-- Migration: Drop earning.driver_id (denormalized; driver is derived from
-- trip.driver_id, which dispatch assigns write-once before the trip completes).
--
-- Rationale: the copy was a write-time obligation every insert path had to
-- satisfy. booking-finalizer wrote NULL, so every real (non-seeded) completed
-- trip silently failed to pay out at processTripPayout's `if (!tripDriver) return`.
--
-- payout.driver_id is deliberately KEPT: it is the immutable payee snapshot for
-- the settlement record, and driver-scoped payout history reads it directly.

-- Pre-apply check — MUST return 0 rows. These rows pay out today (earning
-- carried the driver) but would stop paying out once the processor reads
-- trip.driver_id instead.
-- SELECT e.id, e.driver_id, t.driver_id AS trip_driver_id
--   FROM "earning" e
--   JOIN "trip" t ON t.id = e."trip_id"
--   WHERE e."driver_id" IS NOT NULL AND t."driver_id" IS NULL;

DROP INDEX IF EXISTS "earning_driver_id_idx";

ALTER TABLE "earning" DROP CONSTRAINT IF EXISTS "earning_driver_id_driver_id_fk";

ALTER TABLE "earning" DROP COLUMN IF EXISTS "driver_id";