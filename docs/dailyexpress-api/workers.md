# Workers module scenarios

Module: `dailyexpress-api/workers`

Workers own durable retryable background execution through pg-boss. Application
services enqueue jobs through `jobService.ts`; worker files process jobs.

## Queues

- `email.send`
- `driver.bank_verification`
- `payment.expire`
- `process.webhook`
- `payout.process`
- Matching DLQs for email, bank verification, payment expiry, payment webhooks,
  and payouts.

## Success

- Startup calls `getBoss()` and `startWorkers()`, creates queues, registers all
  workers, and logs queue startup.
- `jobService.enqueue` inserts pg-boss jobs through the caller transaction, using
  queue defaults from `pgboss.queue`.
- Email worker sends rendered HTML through `MailService`.
- Bank verification worker resolves account details with Kora, updates driver
  bank verification status to active, creates a managed success notification,
  and publishes realtime after commit.
- Payment expiry worker calls `PaymentService.handlePaymentExpiry`.
- Payment webhook worker calls `PaymentService.processWebhookJob`.
- Payout worker calls `PayoutService.triggerPayout`.
- Shutdown calls `stopBoss({ graceful: true, timeout: 15000 })`.

## Failure

- Stale bank verification jobs are skipped when driver bank details no longer
  match the queued payload.
- Bank verification provider failures set driver bank verification to failed,
  create a managed failure notification, and publish realtime after commit.
- Payment expiry skips missing or terminal payments.
- Payment webhook skips unsupported events and missing references.
- Payout worker skips non-payable earnings and schedules retries for configured
  payout failure cases.
- DLQ workers log jobs that exhausted retry policy.

## Error

- Worker handler exceptions are logged and rethrown so pg-boss can retry or send
  the job to DLQ.
- pg-boss emits `error` and `warning` events to the shared logger.
- If a transaction-scoped enqueue fails, the caller transaction fails and rolls
  back its critical state.

