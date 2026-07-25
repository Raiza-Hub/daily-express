-- Remove webhook_processed table, use payment_webhook for dedup instead.
-- Add NOT NULL constraints and unique index on (event_type, payment_reference).

DELETE FROM payment_webhook WHERE payment_reference IS NULL;

ALTER TABLE payment_webhook ALTER COLUMN payment_reference SET NOT NULL;
ALTER TABLE payment_webhook ALTER COLUMN event_type SET NOT NULL;
ALTER TABLE payment_webhook ALTER COLUMN event_type DROP DEFAULT;

CREATE UNIQUE INDEX IF NOT EXISTS payment_webhook_dedup_idx ON payment_webhook (event_type, payment_reference);

DROP TABLE webhook_processed;