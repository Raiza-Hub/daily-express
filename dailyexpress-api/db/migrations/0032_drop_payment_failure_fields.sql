-- Drop payment failure audit fields. Charge failure reasons/codes are no longer
-- persisted: the charge webhook trusts the signed Kora payload, and payer
-- details are backfilled by the PAYER_INFO pg-boss worker.
--
-- Non-destructive, autocommit-per-statement (apply via `railway connect Postgres`).

ALTER TABLE "payment" DROP COLUMN IF EXISTS "failed_at";
ALTER TABLE "payment" DROP COLUMN IF EXISTS "failure_code";
ALTER TABLE "payment" DROP COLUMN IF EXISTS "failure_reason";