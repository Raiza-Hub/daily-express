-- Migration: 004_payout_queue_hardening.sql
-- Enforce one payout row per earning to match queue-level singleton processing

BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payout_earning_unique
  ON payout(earning_id);

COMMIT;
