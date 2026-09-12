-- Drop payout + refund failure audit fields and the refund reason. Failure
-- reasons/codes/timestamps are no longer persisted: payouts and refunds
-- transition to terminal states without recording why (the driver/customer
-- email notification still carries the reason text, and the Kora narration
-- still carries the refund reason at transfer time).
--
-- Non-destructive, autocommit-per-statement (apply via `railway connect Postgres`).

ALTER TABLE "payout" DROP COLUMN IF EXISTS "failed_at";
ALTER TABLE "payout" DROP COLUMN IF EXISTS "failure_code";
ALTER TABLE "payout" DROP COLUMN IF EXISTS "failure_reason";

ALTER TABLE "refund" DROP COLUMN IF EXISTS "failure_reason";
ALTER TABLE "refund" DROP COLUMN IF EXISTS "reason";