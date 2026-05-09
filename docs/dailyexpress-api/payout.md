# Payout module scenarios

Module: `dailyexpress-api/payout`

Payout owns earnings, payout rows, payout attempts, Kora transfer initiation,
Kora transfer webhooks, payout balance/history/summary APIs, and terminal payout
effects.

## Main routes

- `GET /api/v1/payouts/balance`
- `GET /api/v1/payouts/history`
- `GET /api/v1/payouts/summary?week=YYYY-MM-DD`
- `POST /api/v1/payouts/webhooks/kora`
- `GET /api/v1/payouts/health`

## Success

- Balance resolves the current driver and totals earnings by status:
  pending trip completion, available, processing/reserved, and paid.
- History resolves the driver, applies optional status/cursor/limit filters, and
  returns payout rows newest first.
- Summary validates the week date and aggregates successful payouts settled
  within that week.
- Payment confirmation calls
  `createEarningForConfirmedBookingInTransaction`, which inserts one earning per
  booking with a 10% platform fee and `pending_trip_completion` status.
- Route trip completion calls `markTripCompletedInTransaction`, which releases
  eligible earnings to `available` and enqueues one payout job per earning in
  the same transaction.
- Payout worker skips non-payable earnings, creates or reuses the payout row,
  ensures a recipient from already verified driver bank fields, checks Kora
  balance, and initiates the transfer with `merchant_bears_cost: false`.
- Successful transfer settlement marks the attempt settled, payout success,
  earning paid, updates driver payout stats, creates a payout-completed
  notification, and publishes realtime after commit.
- Kora payout webhooks validate shape, verify signature over `data`, audit the
  webhook, and process `transfer.success` / `transfer.failed` idempotently.

## Failure

- Missing auth on protected payout APIs returns `401`.
- Missing or inactive driver returns zero balance or empty history.
- Invalid summary week returns `400`.
- Non-payable earnings are skipped.
- Missing verified bank data retries while retry budget remains, then can become
  permanent failure.
- Insufficient Kora balance schedules a later retry.
- Retryable Kora errors and ambiguous initiation errors schedule retry or
  verification retry.
- Permanent failures mark payout `permanent_failed`, earning `manual_review`,
  create a payout-failed notification, and publish realtime after commit.
- Invalid payout webhook signatures are audited, marked processed, and ignored
  with HTTP `200`.
- Unknown/missing webhook references are marked processed and ignored.

## Error

- Kora balance, transfer, payout lookup, DB, transaction, notification, realtime,
  and pg-boss enqueue errors surface through the worker or controller.
- Payout worker errors use pg-boss retry/DLQ behavior according to queue
  settings.
- State changes that belong together are wrapped in transactions; provider calls
  happen outside those transactions.

