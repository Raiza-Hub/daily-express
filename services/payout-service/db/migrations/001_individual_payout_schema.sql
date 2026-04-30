-- Migration: 001_individual_payout_schema.sql
-- Individual trip-based payout system
-- Replaces bulk daily payout with instant individual payouts on trip completion

BEGIN;

-- ── Remove bulk payout tables ──────────────────────────────────────────────
DROP TABLE IF EXISTS bulk_payout_item;
DROP TABLE IF EXISTS bulk_payout_batch;

ALTER TABLE earning
  DROP COLUMN IF EXISTS reserved_at,
  DROP COLUMN IF EXISTS reserved_by_batch_id;

-- ── Update payout table ────────────────────────────────────────────────────
ALTER TABLE payout
  RENAME COLUMN fee_amount_minor TO kora_fee_amount;

ALTER TABLE payout
  ALTER COLUMN kora_fee_amount DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS failure_reason TEXT,
  ADD COLUMN IF NOT EXISTS settled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS failed_at TIMESTAMPTZ,
  DROP COLUMN IF EXISTS batch_id,
  DROP COLUMN IF EXISTS base_reference;

-- ── New: payout_attempt table ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payout_attempt (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_id      UUID        NOT NULL REFERENCES payout(id),
  attempt_number INTEGER     NOT NULL,
  kora_reference TEXT        NOT NULL UNIQUE,
  status         TEXT        NOT NULL DEFAULT 'pending',
  failure_reason TEXT,
  initiated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  settled_at     TIMESTAMPTZ,
  raw_webhook    JSONB,
  UNIQUE (payout_id, attempt_number)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_payout_attempt_reference ON payout_attempt(kora_reference);
CREATE INDEX IF NOT EXISTS idx_payout_attempt_payout ON payout_attempt(payout_id);
CREATE INDEX IF NOT EXISTS idx_payout_status_retry ON payout(status, next_retry_at)
  WHERE status IN ('failed', 'processing');

COMMIT;
