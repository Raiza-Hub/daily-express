-- Migration: 003_payout_status_success.sql
-- Align payout status naming with Kora's webhook payloads

BEGIN;

ALTER TYPE payout_status RENAME VALUE 'paid' TO 'success';

COMMIT;
