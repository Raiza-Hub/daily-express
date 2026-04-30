-- Migration: 002_driver_payout_profile_projection.sql
-- Local Kafka-driven projection of payout-relevant driver data

BEGIN;

CREATE TABLE IF NOT EXISTS driver_payout_profile (
  driver_id UUID PRIMARY KEY,
  user_id UUID,
  email VARCHAR(255),
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  currency VARCHAR(8) NOT NULL DEFAULT 'NGN',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  bank_name TEXT,
  bank_code VARCHAR(32),
  account_number TEXT,
  account_name TEXT,
  bank_verification_status VARCHAR(32),
  bank_verification_failure_reason TEXT,
  source_updated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_driver_payout_profile_user_id
  ON driver_payout_profile(user_id);

CREATE INDEX IF NOT EXISTS idx_driver_payout_profile_active
  ON driver_payout_profile(is_active);

COMMIT;
