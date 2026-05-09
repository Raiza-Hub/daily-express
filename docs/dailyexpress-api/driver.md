# Driver module scenarios

Module: `dailyexpress-api/driver`

Driver owns driver profiles, driver stats, bank verification request state, and
direct stats methods called by route/payment/payout flows.

## Main routes

- `GET /api/v1/driver/profile`
- `POST /api/v1/driver/create`
- `PUT /api/v1/driver/update`
- `DELETE /api/v1/driver/delete`
- `GET /api/v1/driver/stats`

## Success

- Get profile resolves the authenticated user and returns the driver row or
  `null` when no profile exists.
- Create profile rejects duplicates, sanitizes inputs, inserts the driver with
  `bankVerificationStatus = "pending"`, inserts the stats row, creates the
  managed bank-verification pending notification, and enqueues
  `driver.bank_verification` in one transaction. After commit, it publishes the
  notification when the state is visible.
- Update profile sanitizes input and updates the existing driver. If bank details
  changed, it resets bank verification to pending, creates the managed pending
  notification, and enqueues bank verification in the same transaction. After
  commit, it publishes the notification when needed.
- If update is called before a driver exists, it creates the driver profile.
- Delete profile deletes driver stats and the driver row in one transaction.
- Get stats resolves the driver profile and returns `driverStats`.
- Direct stats helpers update totals inside caller-owned transactions:
  confirmed bookings increase passengers and future/same-day pending payments;
  payout completion increases earnings and decreases pending payments; route
  create/delete adjusts active route count.

## Failure

- Missing auth returns `401`.
- Create duplicate profile returns `400`.
- Delete missing driver returns `404`.
- Stats for missing driver returns `404` from the controller profile check.
- Missing stats row returns `404`.
- Bank-verification jobs become stale when the driver row no longer matches the
  queued bank details; the worker skips those jobs.

## Error

- Cloudinary upload, validation, database, transaction, notification creation,
  pg-boss enqueue, and realtime publish errors bubble to the controller error
  handler.
- Transaction failures roll back driver, stats, notification, and job insertion.
- Realtime publish happens after commit; if it fails, the DB state remains saved
  and the exception is handled as an API error for the request that attempted it.
  