-- Drop the payment-webhook dedup/audit table.
-- Idempotency is now relied on:
--   - claimPayment (status 'pending' -> 'processing') on the charge path
--   - finalizeRefund's pending-refund lookup on the refund path
-- Payout webhooks never used this table.

DROP TABLE payment_webhook;