# DailyExpress API module overview

This folder documents what each `dailyexpress-api` module does on success,
expected failure, and unexpected error.

## Shared request flow

The API starts in `dailyexpress-api/index.ts`.

- Express loads security, CORS, cookie parsing, JSON parsing, request logging,
  pg-boss, and all workers.
- Routes are mounted under:
  - `/api/v1/auth`
  - `/api/v1/driver`
  - `/api/v1/route`
  - `/api/v1/payments`
  - `/api/v1/payouts`
  - `/api/v1/notifications`
- Public paths bypass protected auth through `publicPaths.ts`.
- Public auth, public route search, protected routes, and webhooks have separate
  rate limiters.
- Controllers use `asyncHandler`, return shared success/error response shapes,
  and pass unexpected exceptions to the API error handler.
- Sentry captures startup/shutdown failures and request errors through the
  shared error handler.

## Shared success rules

- Critical business state is written to PostgreSQL through Drizzle.
- Multi-row critical changes use explicit DB transactions.
- Retryable/slow work is queued through pg-boss with `workers/jobService.ts`.
- Realtime notification delivery happens after the DB commit.
- External providers are called outside DB transactions except where the code is
  intentionally doing provider verification before starting a DB transaction.

## Shared failure rules

Expected failures are business or validation outcomes such as:

- missing authentication;
- validation failures;
- not found records;
- duplicate records;
- unauthorized ownership checks;
- expired holds/tokens;
- failed provider verification;
- stale background jobs.

These failures return controlled HTTP responses or worker logs and avoid partial
critical state whenever the operation uses a transaction.

## Shared error rules

Unexpected errors are thrown exceptions from the database, network, provider
clients, serialization, workers, or infrastructure. They are handled by:

- Express `asyncHandler` and `errorHandler` for HTTP requests;
- pg-boss retry/DLQ behavior for worker jobs;
- logger/Sentry capture for startup, shutdown, and request-level errors.
