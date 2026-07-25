-- Remove payout_webhook table. payout_attempt.raw_webhook already stores the
-- same webhook payload, making this table redundant.

DROP TABLE IF EXISTS payout_webhook;