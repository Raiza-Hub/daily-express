# Payment module scenarios

Module: `dailyexpress-api/payment`

Payment owns Kora checkout initialization, booking holds, payment expiry,
payment webhooks, return-url reconciliation, refunds, and terminal payment
effects on bookings.

## Main routes

- `POST /api/v1/payments/initialize`
- `GET /api/v1/payments/return`
- `POST /api/v1/payments/webhooks/kora`
- `GET /api/v1/payments/health`

## Success

- Initialize payment requires an authenticated user and an existing unexpired
  booking hold owned by that user. It charges the trusted hold amount plus the
  10% checkout fee, rejects amounts over `NGN 200,000`, sends
  `merchant_bears_cost: false` to Kora, stores the Kora checkout response, and
  schedules payment expiry in one transaction.
- Existing pending checkouts are verified with Kora. Provider `success` confirms
  the payment, provider `pending/processing` returns the existing checkout, and
  terminal provider statuses refresh the checkout with a new Kora reference.
- Kora webhook requests validate shape, verify `x-korapay-signature` over
  `JSON.stringify(data)`, audit the webhook, and enqueue `process.webhook` in
  the same transaction when the signature is valid.
- Payment webhook worker processes `charge.success`, `charge.failed`,
  `refund.success`, and `refund.failed`.
- Successful charge handling verifies the transaction with Kora before trusting
  it. If the hold exists and is unexpired, one transaction marks payment
  successful, confirms the booking, updates booking payment status/reference,
  records driver stats, creates payout earning, creates driver notification,
  enqueues booking-confirmed email, and deletes the booking hold. Realtime
  notification delivery happens after commit.
- Payment expiry verifies Kora status. Paid but expired/missing holds are moved
  into auto-refund; unpaid pending payments become expired and release the hold.
- Return-url reconciliation verifies the current Kora status and redirects the
  browser to the frontend trip-status page.
- Refund success/failure webhooks update terminal refund status.

## Failure

- Missing auth returns `401`.
- Missing, expired, or wrong-user hold returns `404` or `400`.
- Currency mismatch returns `400`.
- Checkout amount above `NGN 200,000` returns `400` before Kora is called.
- Malformed webhooks return `400`.
- Invalid webhook signatures are audited and ignored with HTTP `200`.
- Amount or currency mismatch after Kora verification fails the payment with
  `AMOUNT_MISMATCH` or `CURRENCY_MISMATCH`.
- Missing or expired hold after a successful Kora payment triggers auto-refund.
- Failed/cancelled/abandoned provider states mark the payment terminal and sync
  booking state.
- Missing payment status lookup returns `404`.

## Error

- Kora API, DB, transaction, pg-boss enqueue, email render/enqueue, payout,
  driver stats, notification, refund, and realtime errors bubble through the
  controller or worker.
- Worker errors are retried by pg-boss and can land in the webhook/expiry DLQ.
- Confirmation side effects are transactional; if any DB-critical write or job
  enqueue fails, payment confirmation rolls back.
- External provider calls are made outside the confirmation transaction.
