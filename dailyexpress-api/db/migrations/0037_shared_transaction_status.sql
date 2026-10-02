-- Collapse payment.status and refund.status onto one shared three-state
-- transaction_status enum, and make refund a real child of payment.
--
-- transaction_status: ('pending', 'successful', 'failed')
--
-- 'processing' is REMOVED from payment.status. It only ever existed as a
-- claim token: charge.success/charge.failed first flipped pending ->
-- processing (claimPayment) and then flipped processing -> terminal in a
-- SECOND transaction. A crash between the two stranded the payment in
-- 'processing' forever, because every later write was filtered on
-- status = 'processing'. Both webhooks now do a single atomic
-- `UPDATE ... WHERE status = 'pending' RETURNING *`, so the claim step and
-- the settle step are the same statement and there is no stranding window.
-- A duplicate delivery simply matches zero rows and is dropped.
--
-- The four refund_* values on payment.status ('refund_pending', 'refunded',
-- 'refund_failed') and the dead 'cancelled' / 'expired' are REMOVED. A
-- charge's status describes the CHARGE; a refund is its own row and is
-- reached through payment.refund_id / refund.payment_id. Nothing writes
-- these values any more.
--
-- payment.refund_id is a pointer to this payment's CURRENT refund attempt.
-- refund.payment_id stays NOT NULL and is the authority for ownership; the
-- pointer exists so the current refund is one indexed lookup away. It is
-- non-unique-safe: a refund belongs to exactly one payment by
-- refund.payment_id, so two payments can never legitimately point at the
-- same row (the unique index below enforces it anyway).
--
-- Refund model is one row PER ATTEMPT, not one row per payment:
--   - Kora's disburse API has no documented idempotency header, so whether a
--     duplicate `reference` is rejected or re-executed is undefined. Sending
--     a reference twice could therefore double-refund.
--   - Each attempt therefore gets a FRESH reference, and Kora is never sent a
--     reference it has already seen.
--   - refund_payment_pending_unique_idx keeps at most one LIVE attempt per
--     payment, so a retry can never race an in-flight one.
--   - 'failed' is only ever written on a DEFINITIVE provider rejection (Kora
--     errored and lookup-by-reference found nothing) or when the DLQ gives
--     up. Ambiguous outcomes stay 'pending' and are resolved by the webhook,
--     which is what makes retry-after-failed safe.
--
-- refund.booking_id is DROPPED: it was write-only, never read, and the
-- booking is already reachable via payment.booking_id.
--
-- booking.payment_status is DROPPED: it was a denormalized varchar mirror of
-- the payment+refund pair. Booking reads now LEFT JOIN payment -> refund and
-- expose the raw paymentStatus plus a nullable refundStatus.
--
-- Non-destructive: no rows are deleted. Both enums are rebuilt via type swap
-- because PostgreSQL does not implement `ALTER TYPE ... DROP VALUE`.
-- Apply via `railway connect Postgres` (autocommit per statement).
--
-- Note: live `refund` also carries legacy `passenger_id` / `passenger_name`
-- columns that are absent from the Drizzle schema. They are untouched here.

-- ---------------------------------------------------------------------------
-- transaction_status
-- ---------------------------------------------------------------------------

CREATE TYPE transaction_status AS ENUM ('pending', 'successful', 'failed');

-- ---------------------------------------------------------------------------
-- payment.status -> transaction_status
-- ---------------------------------------------------------------------------

-- Normalise BEFORE the cast. Without this, any row holding a value outside
-- ('pending', 'successful', 'failed') makes the conversion fail outright.
--
--   initialized      -> pending   (a checkout that was created but not yet
--                                  handed a checkout_url is still in flight;
--                                  crash-resume keys off checkout_url IS NULL)
--   processing       -> pending   (a claim that never settled; reverting lets
--                                  a redelivered webhook settle it, which is
--                                  exactly what the new CAS does)
--   cancelled/expired-> failed    (dead values, but must cast)
--   refund_*         -> successful(the CHARGE succeeded; the refund is a
--                                  separate row reached via refund_id)
UPDATE payment SET status = 'pending'
WHERE status IN ('initialized', 'processing');

UPDATE payment SET status = 'failed'
WHERE status IN ('cancelled', 'expired');

UPDATE payment SET status = 'successful'
WHERE status IN ('refund_pending', 'refunded', 'refund_failed');

ALTER TABLE payment ALTER COLUMN status DROP DEFAULT;
ALTER TABLE payment
  ALTER COLUMN status TYPE transaction_status USING status::text::transaction_status;
ALTER TABLE payment
  ALTER COLUMN status SET DEFAULT 'pending'::transaction_status;

-- ---------------------------------------------------------------------------
-- refund.status -> transaction_status
-- ---------------------------------------------------------------------------

-- No normalisation needed: refund_status is already exactly
-- ('pending', 'successful', 'failed'), so the cast is lossless. The type swap
-- exists only so both tables share one enum instead of two identical ones.
ALTER TABLE refund ALTER COLUMN status DROP DEFAULT;
ALTER TABLE refund
  ALTER COLUMN status TYPE transaction_status USING status::text::transaction_status;
ALTER TABLE refund
  ALTER COLUMN status SET DEFAULT 'pending'::transaction_status;

DROP TYPE payment_status;
DROP TYPE refund_status;

-- ---------------------------------------------------------------------------
-- refund as a child of payment
-- ---------------------------------------------------------------------------

-- Write-only column: never read, and the booking is reachable via
-- payment.booking_id. Dropping it is safe on both dev and prod.
ALTER TABLE refund DROP COLUMN IF EXISTS booking_id;

-- refund.payment_id had NO index at all (only refund_pkey, refund_passenger_id_idx
-- and refund_reference_unique), yet every read of a refund filters on it. The
-- reconcile-or-create path and the DLQ both do.
CREATE INDEX IF NOT EXISTS refund_payment_id_idx ON refund (payment_id);

-- At most one live attempt per payment. Enforced in the database so a retried
-- job, a manual retry, and a webhook-driven retry cannot all open attempts
-- concurrently. Terminal ('successful' / 'failed') rows are excluded, which is
-- what allows a retry to create a fresh row after a definitive failure.
CREATE UNIQUE INDEX IF NOT EXISTS refund_payment_pending_unique_idx
  ON refund (payment_id)
  WHERE status = 'pending';

-- Pointer to this payment's current refund attempt. SET NULL rather than
-- RESTRICT to match payment.booking_id; refunds are never deleted in practice.
ALTER TABLE payment
  ADD COLUMN IF NOT EXISTS refund_id uuid REFERENCES refund (id) ON DELETE SET NULL;

-- A refund belongs to exactly one payment (refund.payment_id NOT NULL), so
-- two payments pointing at the same refund is always a bug. Unique still
-- permits any number of NULLs, i.e. every payment that was never refunded.
CREATE UNIQUE INDEX IF NOT EXISTS payment_refund_id_unique_idx
  ON payment (refund_id);

-- ---------------------------------------------------------------------------
-- booking.payment_status -> drop the denormalized mirror
-- ---------------------------------------------------------------------------

-- Visibility for GET /user/bookings is now derived by joining payment
-- (filtered on status = 'successful', which reproduces the previous
-- four-value allow-list exactly) and surfacing refund.status separately.
ALTER TABLE booking DROP COLUMN IF EXISTS payment_status;
