-- Migration: Simplify payout status enum & remove earning status column
--
-- 1. Drop earning.status column (no longer used; payout table owns lifecycle state)
-- 2. Drop earning_status enum type
-- 3. Rename payout_status 'success' → 'successful', drop 'processing' (type swap)
-- 4. Rebuild partial unique index after enum swap
-- 5. Constrain earning.payout_id → payout.id (was an unconstrained uuid column)

-- Step 1: Drop earning status column
ALTER TABLE "earning" DROP COLUMN IF EXISTS "status";

-- Step 2: Drop the earning_status enum type
DROP TYPE IF EXISTS "earning_status";

-- Step 3: Rename 'success' → 'successful' (PG 10+)
ALTER TYPE "payout_status" RENAME VALUE 'success' TO 'successful';

-- Step 4: Migrate 'processing' rows to 'pending' before dropping the value
UPDATE "payout" SET "status" = 'pending' WHERE "status" = 'processing';

-- Step 5: Type swap to drop 'processing' (Postgres cannot DROP VALUE from an enum)
ALTER TYPE "payout_status" RENAME TO "payout_status_old";
CREATE TYPE "payout_status" AS ENUM ('pending', 'successful', 'failed');

ALTER TABLE "payout"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "payout_status" USING "status"::text::"payout_status",
  ALTER COLUMN "status" SET DEFAULT 'pending';

DROP TYPE "payout_status_old";

-- Step 6: Rebuild partial unique index (enum swap may invalidate it)
DROP INDEX IF EXISTS "payout_trip_active_unique_idx";
CREATE UNIQUE INDEX "payout_trip_active_unique_idx"
  ON "payout" ("trip_id")
  WHERE "trip_id" IS NOT NULL AND "status" <> 'failed';

-- Step 7: Constrain earning.payout_id (previously an unconstrained uuid column).
-- Orphans are NOT auto-deleted: these are financial rows, so the ADD CONSTRAINT
-- fails loudly instead. Run the pre-check first; it must return 0 rows.
-- SELECT e.id FROM "earning" e
--   WHERE e."payout_id" IS NOT NULL
--     AND NOT EXISTS (SELECT 1 FROM "payout" p WHERE p.id = e."payout_id");

ALTER TABLE "earning"
  ADD CONSTRAINT "earning_payout_id_payout_id_fk"
  FOREIGN KEY ("payout_id") REFERENCES "payout"("id")
  ON DELETE restrict ON UPDATE no action;
