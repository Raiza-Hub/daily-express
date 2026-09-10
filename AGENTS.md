# AGENTS.md

Instructions for AI coding agents working with this codebase.

<!-- opensrc:start -->

## Source Code Reference

Source code for dependencies is available in `opensrc/` for deeper understanding of implementation details.

See `opensrc/sources.json` for the list of available packages and their versions.

Use this source code when you need to understand how a package works internally, not just its types/interface.

### Fetching Additional Source Code

To fetch source code for a package or repository you need to understand, run:

```bash
npx opensrc <package>           # npm package (e.g., npx opensrc zod)
npx opensrc pypi:<package>      # Python package (e.g., npx opensrc pypi:requests)
npx opensrc crates:<package>    # Rust crate (e.g., npx opensrc crates:serde)
npx opensrc <owner>/<repo>      # GitHub repo (e.g., npx opensrc vercel/ai)
```

<!-- opensrc:end -->

## Goal
- Per-trip payout aggregation: one payout per (driver, trip) instead of one payout per earning.
- Payout records are **immutable single-attempt records**: one `payout` row = exactly one transfer attempt; `success` and `failed` are terminal states that are never mutated again. Retries (via re-completing the trip) create a **new** payout row.
- No auto-retry, no `payout_attempt` table, no `permanent_failed` status.

## Constraints & Preferences
- Leave legacy 2 existing payout rows untouched (`trip_id NULL`, no backfill).
- `payout.reference` is sent directly to Kora (unique per row). No `_attempt_N` suffixes.
- Drop `payout.earning_id`, `provider_transfer_code`, `provider_transfer_id`, `earnings_count`, `retry_count`, `next_retry_at` entirely.
- Drop `payout_attempt` table entirely. Drop `manual_review` earning status + `in_review_payments` column entirely.
- Keep "In Review" UI card: hardcode `0` on frontend, no `inReviewPayments` type/API plumbing.
- Do NOT change payout failure notification message.
- Failure → earnings back to `available` (retryable via complete button); `failed` payout row is never reused or reset — retry creates a new row.
- Insufficient balance → fails immediately (terminal `failed` + driver notification). No long-delay auto-retry.
- Ambiguous initiation errors (network/5xx, `unknown` verification) → payout stays `processing`; the provider webhook confirms the final state. No auto re-verify.
- Trip re-completion is the retry mechanism: `completeTrip` allows re-completion iff `hasUnsettledEarnings`.
- Migration applied manually to prod via `railway connect Postgres` (autocommit per statement; `ALTER TYPE ... DROP VALUE` must be standalone).

## Progress
### Done
- Schema: `dailyexpress-api/db/payout-schema.ts` — `payoutStatusEnum` = `('pending','processing','success','failed')`; `payout` has `tripId` (FK → trip, restrict), removed `earningId`, `earningsCount`, `providerTransferCode`, `providerTransferId`, `retryCount`, `nextRetryAt`, index `payout_status_retry_idx`, unique index `payout_driver_trip_unique_idx`, and the `payoutAttempt` table + types. `earningStatusEnum` has no `"manual_review"`.
- Schema: `dailyexpress-api/db/driver-schema.ts` — removed `inReviewPayments`.
- Migrations:
  - `0014_aggregate_payouts_per_trip.sql` — APPLIED to prod: payout column drops/adds, `trip_id` FK, partial unique index, `driver_stats` column drop, `earning_status` enum type-swap (see Prod Migration Notes).
  - `0015_immutable_payouts.sql` — APPLIED to prod: drops `payout_driver_trip_unique_idx` + `payout_status_retry_idx`, drops `payout_attempt` table, drops `retry_count`/`next_retry_at`, `permanent_failed → failed`, `payout_status` enum type-swap to 4 values.
  - `0016_drop_payout_raw_response_fields.sql` — APPLIED to prod: drops `raw_initiate_response` + `raw_final_status_response` (written but never read).
  - `0017_drop_payment_webhook.sql` — APPLIED to prod: drops the `payment_webhook` dedup/audit table. Charge idempotency now relies on `claimPayment` (`pending→processing`), refunds on `finalizeRefund`'s pending-refund lookup; payout webhooks never used it.
- Job layer:
  - `workers/boss.ts`: `PayoutProcessJobData = { tripId: string }`.
  - `workers/job.service.ts`: `enqueuePayout` singletonKey = `payload.tripId`.
  - `workers/payout.worker.ts`: `triggerPayout(job.data.tripId)`.
  - `workers/driver-verification.worker.ts`: removed auto re-enqueue block + unused imports.
- Repository (`payout/payout.repository.ts`): `findPayoutByTripId` (latest by `createdAt DESC, id DESC`), `findPayoutByReference`, `findTripPayoutEarnings` (available/processing), `hasUnsettledEarnings` (pending_trip_completion/available/processing), `insertPayout` (plain returning, no `onConflictDoNothing`). Removed all `payoutAttempt` methods and `retryFailedPayoutForTrip`.
- `payout/earning.service.ts` `completeTrip`: releases pending → available, enqueues one `{ tripId }` job if `hasUnsettledEarnings`. No `retryFailedPayoutForTrip` call.
- `payout/payout-settlement.service.ts` (NEW, replaces `payout-attempt.service.ts`): `verifyWithProvider(payout)` (lookup by `payout.reference`; no record → `"failed"`, success → `finalizePayout`, provider failed → `"failed"`, else `"processing"`, lookup API error → `"unknown"`); `finalizePayout(payout)` (immutability guard `success`/`failed` → skip; payout → success, trip earnings → paid, stats adjusted, success notification).
- `payout/payout-processor.service.ts`: `processTripPayout` reads latest payout first — if it exists and is NOT `failed` (`pending`/`processing`/`success`) → return early (no new row; wait for webhook on `pending`/`processing`); only proceeds to create a NEW payout row when latest is `failed` (retry) or none exists. `createTripPayout` inserts a new row (no reuse branch); `executeAttempt` = single attempt (reference = `payout.reference`), `FOR UPDATE` lock skip if `success`/`failed`/`processing`, marks payout + trip earnings processing, initiates Kora; failure paths → `errorCode === "conflict"` (insufficient balance) → `processPayoutFailure` (terminal) or any other error → `verifyWithProvider` (settled→done, failed→fail, processing/unknown→leave for webhook). No fatal-error-code special-casing (all non-conflict errors go through verification). Removed `scheduleRetry`, `canRetry`, `processVerificationRetryOutcome`, `payoutRetryDelaysMs`, `isFatalKoraError`, `isRetryableKoraError`.
- `payout/payout-notification.service.ts` `processPayoutFailure`: payout → `failed` (guard `success`/`failed`); trip earnings processing → available; failure notification message unchanged.
- `payout/payout-webhook.service.ts`: resolves payout by `reference`; guards `success`/`failed` only; `transfer.success` → `finalizePayout`; `transfer.failed` → `processPayoutFailure` (no retry branches).
- `payment/payment-webhook.service.ts`: charge webhooks (`charge.success`/`charge.failed`) are processed synchronously in the webhook handler (no `WEBHOOK_PROCESS` queue/worker). Duplicate safety via `claimPayment` (`pending→processing`); `verifyTransaction` kept for payer bank details (used by refunds) + status reconciliation. Refund webhooks (`transfer.* REF-`) → `finalizeRefund`; payout webhooks (`transfer.*`) → `payoutWebhookService.processWebhook`.
- `payout/payout.service.ts`: `triggerPayout(tripId)` → `processTripPayout`; `hasUnsettledEarnings(tripId)`; `getHistory` includes `tripId`, no `nextRetryAt`; removed `scheduleRetry`/`canRetry` wrappers.
- `config/index.ts`: removed `PAYOUT_RETRY_DELAYS_MS`, `INSUFFICIENT_BALANCE_RETRY_DELAY_MS`.
- `route/trip.service.ts` `completeTrip`: allows re-completion iff `hasUnsettledEarnings(tripId)` (otherwise still throws "Trip is already completed"). `getDailyTripSummaries` returns per-trip latest `payoutStatus` via `selectDistinctOn(payout.tripId)` ordered by `createdAt DESC, id DESC`.
- Frontend:
  - `packages/api/src/hooks/booking.ts`: `TripsSummaryRange.trips[]` + `payoutStatus?: string | null`.
  - `apps/drivers/app/lib/type.ts`: `RouteWithTrips` + `payoutStatus?: string | null`.
  - `apps/drivers/app/components/route/RouteCard.tsx`: threads `payoutStatus` from trip summary.
  - `apps/drivers/app/components/route/RouteCardItem.tsx`: button shows "Retry Payout" (enabled) when completed && `payoutStatus === "failed"`; "Trip Completed" (disabled) when completed && status !== "failed"; `handleCompleteTrip` no longer blocks on `isCompleted`.
  - `apps/drivers/app/components/StatsCard.tsx`: "In Review" card hardcoded `formatCurrency(0)`.
  - `apps/drivers/app/components/PayoutTable.tsx`: `failed` → "Failed"; `processing` → "Processing"; removed `permanent_failed` "Needs review" branch and `nextRetryAt` "Retry scheduled" branch.
- Shared types: `shared/types/index.ts` — `PayoutStatus` = `processing | success | failed`; `DriverPayout` has `tripId?`, no `nextRetryAt`; removed `inReviewPayments` from `DriverStats`, `"manual_review"` from `EarningStatus`, `earningsCount`.
- `packages/api/src/hooks/driver.ts`: removed `inReviewPayments` from local `DriverStats` interface.
- `dailyexpress-api/driver/driver-stats.service.ts` + `driver/driver.service.ts`: removed `"manual_review"` from local `EarningStatus` types and the `inReview` branch (incl. `inReviewPayments` SQL updates).
- Verified: `check-types` passes for `@dailyexpress-api` (tsc --noEmit), `drivers`, `@repo/api`, `shared`. Lint failures are pre-existing (`@repo/ui` `CaretDown`/`any` warnings, `apps/drivers/next.config.js` no-undef warning) — not introduced here.

### Phase 7 — Remove old driver trip-claim code (COMPLETE 2026-08-31)
Dead claim feature fully removed; dispatch auto-assign is the only assignment path. No DB migration (no schema change).
- Deleted `route/trip-claim.service.ts`, `route/sse-manager.ts` (route-level SSE for `trip_claimed`; notification `sseManager` is a separate live module), `workers/trip-driver-assigned.worker.ts` (its only producer was claim; earnings are covered by `booking-finalizer.service.ts`).
- `route/route.service.ts`: dropped `TripClaimService`/`resolveDriverId` imports, `tripClaim` field/ctor, and `getAvailableTrips`/`getAvailableTripsCountByDate`/`claimTrip`.
- `route/route.controller.ts`: removed `sseManager` import + `streamTripUpdates`, `getAvailableTrips`, `getAvailableTripsCountByDate`, `claimTrip` handlers.
- `route/route.routes.ts`: removed `/trips/live`, `/driver/trips/available`, `/driver/trips/available/calendar`, `/driver/trip/:id/claim`. `driverActionLimiter` kept (completeTrip).
- `route/route.repository.ts`: removed `TripWithRouteAndBookings`, `findTripsWithRouteAndBookingCount`, `countAvailableTripsByDateRange`, pruned `gt`/`or` drizzle imports. Kept `findTripsWithRoute` (admin), `lockTrip`/`assignDriverToTrip`/`findVehicleScheduledAtDeparture` (admin), `findTripWithRoute` (admin + trip.service).
- `workers/boss.ts` + `workers/index.ts`: removed `TRIP_DRIVER_ASSIGNED`/`_DLQ` queues, `TripDriverAssignedJobData`, queue creation, worker registration.
- `admin/admin-trip.service.ts`: comment no longer references claimTrip (admin external assignment unchanged).
- `packages/api/src/hooks/booking.ts`: removed `AvailableTrip`/`AvailableTripsResponse`/`AvailableTripsCountByDateResponse` + claim/available hooks. `useInfiniteQuery`/`useMutation`/`useQueryClient`/`keepPreviousData` still used by live hooks.
- `apps/drivers`: deleted `(main)/trips/available/page.tsx`, `components/route/{AvailableTripsList,ClaimTripCardItem,PassengerStatusBar}.tsx`, `hooks/useStreamLiveTrips.ts`, `components/RealtimeProvider.tsx`; unmounted `RealtimeProvider` from `components/providers.tsx`; removed commented "Available Trips" NavItem; deleted `combineTripDateAndTime` + `getDateInTz` from `lib/utils.ts`.
- `packages/ui`: deleted `components/driver-calendar.tsx` (claim-only).
- Verified: turbo `check-types` (types/api/ui/web/drivers) + `tsc --noEmit` for dailyexpress-api and shared all pass; grep for claim/SSE/worker residuals returns zero (only live `notification/sseManager` remains, intended).

### Phase 8 — Remove the notification module entirely (COMPLETE 2026-08-31)
Whole in-app notification module removed end-to-end. Notifications are genuinely dead everywhere — no producer, no consumer, no table. Payout failure emails and driver-side state transitions are unaffected.
- Scope: module = `dailyexpress-api/notification/` (controller, repository, routes, service, `sse.routes.ts`, `sseManager.ts`, `realtime.ts`) + `dailyexpress-api/db/notification-schema.ts` + `packages/api/src/hooks/notification.ts` + `notificationApi` in `packages/api/src/api.ts` (incl. its `addCsrfHeader` interceptor). Nothing in apps/web or apps/drivers imported the hooks or used EventSource.
- Deleted: `dailyexpress-api/notification/` (entire dir), `dailyexpress-api/db/notification-schema.ts`, `packages/api/src/hooks/notification.ts`, removed `export * from "./src/hooks/notification";` from `packages/api/index.ts`.
- `db/index.ts`: removed `notification` import/spread/export. `index.ts`: removed `notificationRoutes`/`notificationSSERoutes` imports + mount (also removed `doubleCsrfProtection` from the payouts mount line).
- `shared/types/index.ts`: removed `NotificationTone`, `DriverNotification`, `DRIVER_NOTIFICATION_REALTIME_VERSION`, `DriverNotificationCreatedRealtimeEvent`, `PushSubscriptionPayload`, `PushNotificationPayload`, `driverNotificationSchema` (push types dead; only consumers were notification types). Dropped the now-unused `import { z } from "zod/v4"`.
- `payout/payout-notification.service.ts` rewritten: removed shared notificationService + `publishNotificationCreatedInBackground` + `DriverNotification` + `shouldNotify` param; kept exactly the email path (PayoutFailedEmail render/enqueue) + failure state transitions. `processPayoutFailure(payoutRecord, reason)` is now 2-arg.
- `payout/payout-settlement.service.ts`: removed notification imports, `notificationService` field, `createPayoutSuccessNotification`, the `returning()`/`updated` capture, background publish; success status + stats adjustment preserved verbatim.
- `payout/payout-processor.service.ts`: removed notification imports; inactive-driver + below-minimum branches revert to bare `return;`; dropped `true` arg on both `processPayoutFailure` calls (conflict + failed outcome).
- `payout/payout-webhook.service.ts`: dropped `true` arg on `processPayoutFailure`.
- `workers/driver-verification.worker.ts`: removed four descriptor factories (`bankVerifiedNotification`/`bankFailedNotification`/`kycVerifiedNotification`/`kycFailedNotification`), the `createBankVerificationStateInTransaction`/`createKycVerificationStateInTransaction` calls + background publishes; transactions now `return` `undefined` and use bare `return;` on mismatch; driver status updates intact. The "You can now claim trips." text lived inside `kycVerifiedNotification`, so it was removed with the factory (Phase-7 plan said reword; removal supersedes).
- `driver/driver-profile.service.ts`: removed `getBankVerificationPendingNotification`/`getKycVerificationPendingNotification` + `create...InTransaction` calls + background publishes; the `updateDriver` tx now returns `{ driver: record }`, return is `result.driver`.
- Migration `dailyexpress-api/db/migrations/0022_drop_notification.sql` (NOT YET APPLIED): `DROP TABLE IF EXISTS "notification"; DROP TYPE IF EXISTS "notification_tone";`. The `notification` table (post-0018/0019) held `driver_id` FK, `notification_key`, `type`, `content_hash` dedupe, `tone` enum, `read_at`.
- Payout failure emails (rendered via `@repo/email`, enqueued `email.payout_failed`) and driver-verification pending/verified/failed status transitions were never on the notification table — unaffected.
- Verified: `tsc --noEmit` (dailyexpress-api, shared) + turbo `check-types` (types/api/ui/web/drivers) all pass; residual grep for sseManager/publishNotificationCreated/notificationApi/DriverNotification/NotificationTone/realtime/create*VerificationState returns zero (only the intentionally-kept `payout-notification.service.ts` email service matches "notification").
- Note: `payment-init.service.ts`/`payment.types.ts` `notification_url` is Kora's webhook field — kept (unrelated).

### Phase 9, Part A — Move email dispatch to Cloudflare Queues + Workers (CODE COMPLETE 2026-08-31, not deployed)
Email background processing moved off pg-boss to **Cloudflare Queues + Workers** (structured SESv2 via `aws4fetch` SigV4). Clean swap — no dual-run, no outbox, no KV dedupe, no throttle beyond `max_batch_size`. Dispatch is a direct `EMAIL_QUEUE.send()` (CF REST push) after the caller's DB tx commits; crash-window between commit and push loses that email (accepted). Refund (Part B) payout, and driver-verification logic untouched.
- New `workers/` Cloudflare Worker package (`dailyexpress-email-worker`): `src/consumer.ts` consumes queue `email-send` (`max_batch_size: 2`, `max_retries: 3`, DLQ `email-send-dlq`); validates recipient regex (else ack+drop), POSTs structured SESv2 `SendEmail` (`Content.Simple`, `FromEmailAddress`, `Destination.ToAddresses`) via `aws4fetch` `AwsClient` (service `ses`, region `SES_REGION`); `ack()` on 2xx, `retry({delaySeconds:10})` on throw, 3× → DLQ. Own `package.json`/`tsconfig.json`/`wrangler.jsonc` (nodejs_compat, compatibility_date). Root scripts `email:install`/`email:deploy`/`email:dev-worker`.
- New `dailyexpress-api/mail/email-dispatcher.service.ts`: `sendEmailToQueue({emailName,to,subject,html})` + `EmailToSend`; POSTs `{messages:[{body}]}` to Cloudflare Queues REST (`POST /accounts/{account_id}/queues/{queue_id}/messages`) with `CLOUDFLARE_API_TOKEN` bearer; logs + swallows failures on misconfig/push error (best-effort).
- Retooled 8 email sites to dispatch **post-commit** instead of `jobService.enqueueEmail(tx, ...)` inside the tx: `auth.service.ts` (verify_otp ×2, reset_password), `booking-finalizer.service.ts` (booking_confirmed — returns `pendingEmail` from tx), `payout/payout-notification.service.ts` (payout_failed — tx returns `shouldNotify` bool), `payment/payment-payout-refund.service.ts` (trip_cancelled_refund, refund_successful — methods now `return EmailToSend | null`, dispatched after tx), `workers/trip-refund.worker.ts` DLQ (refund_failed).
- Removed `email.driver_assigned` entirely (user directive): deleted `sendDriverAssignedExternalEmail` + its call and `sendDriverAssignedEmail` + its call in `admin/admin-trip.service.ts` (both external + platform driver-assign emails); pruned now-unused imports (`renderEmail`/`getEmailSubject`, `driverRepository`, `DbTransaction`). Email site count: 10 → 8.
- Removed pg-boss email path: `jobService.enqueueEmail` + `EmailJobPayload` from `workers/job.service.ts`; `EMAIL_SEND`/`EMAIL_SEND_DLQ` queues + creation from `workers/boss.ts`; `registerEmailWorker` from `workers/index.ts`; deleted `workers/email.worker.ts` and `mail/mail.service.ts` (raw-MIME SESv2 — not replicated; the CF consumer uses structured SendEmail).
- `config/index.ts`: added optional `CLOUDFLARE_ACCOUNT_ID`/`CLOUDFLARE_EMAIL_QUEUE_ID`/`CLOUDFLARE_API_TOKEN`; documented in `.env.example`. API-level AWS SES vars (`AWS_REGION`/`AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`/`EMAIL_FROM`) retained in schema but now unused by the API (the CF worker holds its own SES secrets).
- Verified: `tsc --noEmit` (dailyexpress-api, shared) + `tsc --noEmit` (workers) + turbo `check-types` all pass; grep for `enqueueEmail`/`EMAIL_SEND`/`MailService`/`mail.service`/`registerEmailWorker` residuals returns zero.

### In Progress
- Phase 9, Part A is code-complete but **not deployed/live-verified**. Blocked on user verification + live Cloudflare deployment of the `workers/` consumer (queue create, worker deploy, SES secrets) and wiring runtime CF env vars into dailyexpress-api. Part B (moving refund processing to CF) is unplanned until Part A is verified.

### Blocked
- Migrations `0021_drop_zone.sql` and `0022_drop_notification.sql` not applied anywhere (needs a running DB; Docker quit; prod via `railway connect Postgres` when ready). `0021` must run before `0022`'s `DROP TABLE notification` is irrelevant to zone, but apply in order 0020 → 0021 → 0022.
- Phase 9, Part A deploy: Cloudflare account/queue/worker create + secret binding (SES region/keys, `EMAIL_FROM`) + dailyexpress-api runtime env (`CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_EMAIL_QUEUE_ID`, `CLOUDFLARE_API_TOKEN`) not yet configured.

## Prod Migration Notes (0014)
- Applied 2026-08-02 via `railway connect Postgres` (project `daily-express`, prod).
- Table DDL batch (constraint drop, index drop, column drops, `trip_id` add + FK, partial unique index, `driver_stats` column drop) ran fine.
- `ALTER TYPE earning_status DROP VALUE 'manual_review'` FAILS on prod PostgreSQL 18.4 (`dropping an enum value is not implemented`). Worked around with a type swap:
  1. `CREATE TYPE earning_status_new AS ENUM ('pending_trip_completion','available','processing','paid','cancelled');`
  2. `ALTER TABLE earning ALTER COLUMN status DROP DEFAULT;`
  3. `ALTER TABLE earning ALTER COLUMN status TYPE earning_status_new USING status::text::earning_status_new;`
  4. `ALTER TABLE earning ALTER COLUMN status SET DEFAULT 'pending_trip_completion'::earning_status_new;`
  5. `DROP TYPE earning_status; ALTER TYPE earning_status_new RENAME TO earning_status;`
- Verified prod: `payout` has `trip_id` (FK restrict), partial unique index `payout_driver_trip_unique_idx`, no `earning_id`/`provider_transfer_code`/`provider_transfer_id`/`earnings_count`; `driver_stats` has no `in_review_payments`; `earning_status` enum has 5 values (no `manual_review`). Legacy 2 payout rows untouched (`trip_id` NULL, `success`, ₦100 each).

## Prod Migration Notes (0015) — APPLIED 2026-08-02
- Applied to prod via `railway connect Postgres` (piped `0015_immutable_payouts.sql`; autocommit per statement).
- Order: drop `payout_driver_trip_unique_idx` + `payout_status_retry_idx` → `DROP TABLE payout_attempt` (dropped 2 legacy settled attempt rows) → `ALTER TABLE payout DROP COLUMN retry_count, DROP COLUMN next_retry_at;` → `UPDATE payout SET status='failed' WHERE status='permanent_failed';` (UPDATE 0) → `payout_status` enum type-swap (same 5-step recipe as 0014) to `('pending','processing','success','failed')`, restoring default `'processing'`.
- Verified post-apply: `payout_status` enum = 4 values; no `payout_attempt` table; no `retry_count`/`next_retry_at`; legacy 2 payout rows untouched (`trip_id` NULL, `success`).

## Key Decisions
- One payout per (driver, trip), keyed on `payout.trip_id`; amount computed at creation from `available` earnings. `processing` earnings included in eligibility guard but never in creation-time sum.
- **Immutable payouts**: a `payout` row = one transfer attempt. `success`/`failed` are terminal — every guard (`processTripPayout`, `executeAttempt` lock, `finalizePayout`, `processPayoutFailure`, webhook) skips payouts in either state.
- **Retry = new record**: `processTripPayout` returns early unless the latest payout is `failed`/none; only then `createTripPayout` inserts a brand-new payout row. A `failed` payout is never reset — re-completing the trip creates a brand-new payout row. Multiple payout rows per trip are legal (no unique index).
- **No auto-retry**: no `scheduleRetry`/`canRetry`/retryCount/nextRetryAt. Insufficient balance fails immediately. All other initiation errors go through `verifyWithProvider` (no fatal-error special-casing); ambiguous outcomes leave the payout `processing` for the webhook to resolve (`unknown` = lookup API error; no reference found = `failed` since transfer was never created).
- Duplicate-payout protection relies on job singleton key (`tripId`) + `FOR UPDATE` locks + immutable-terminal guards (unique index dropped).
- Trip re-completion is the retry mechanism: `completeTrip` allows re-completion iff `hasUnsettledEarnings`.
- Frontend "Retry Payout" button shows iff the trip's latest `payoutStatus === "failed"` (retry creates a new payout row; `pending`/`processing`/`success` are reused/terminal and not retryable).
- `in_review_payments`: column dropped; "In Review" card stays with hardcoded `formatCurrency(0)`.
- Phase 8 (user-confirmed): remove notification module completely. Emails (PayoutFailedEmail) and driver-side state transitions (bank/kyc statuses, payout/earning statuses, driver_stats) are unaffected.
- Phase 9, Part A: email dispatch is a single post-commit `sendEmailToQueue` push to a Cloudflare Queue (`email-send`); the CF worker is the only SES sender (structured SESv2 via `aws4fetch`, not raw MIME). No pg-boss email path, no outbox, no KV dedupe, no in-worker throttle. `max_batch_size: 2` is the only rate limiter. Crash between DB-commit and CF push loses that email (accepted).

## Relevant Files
### Created
- `dailyexpress-api/db/migrations/0014_aggregate_payouts_per_trip.sql` — Migration: payout column drops/adds, index swaps, `driver_stats` column drop, `earning_status` enum drop-value note.
- `dailyexpress-api/db/migrations/0015_immutable_payouts.sql` — Migration: drop unique/retry indexes, drop `payout_attempt`, drop retry columns, `permanent_failed → failed`, `payout_status` enum type-swap.
- `dailyexpress-api/db/migrations/0022_drop_notification.sql` — Migration: `DROP TABLE notification` + `DROP TYPE notification_tone` (not yet applied).
- `dailyexpress-api/payout/payout-settlement.service.ts` — `verifyWithProvider` + `finalizePayout` (replaces `payout-attempt.service.ts`).
- `dailyexpress-api/mail/email-dispatcher.service.ts` — `sendEmailToQueue` + `EmailToSend`; Cloudflare Queues REST push (Phase 9 Part A).
- `workers/` — Cloudflare Worker package: `src/consumer.ts`, `package.json`, `tsconfig.json`, `wrangler.jsonc` (consumes `email-send`, DLQ `email-send-dlq`, SESv2 via `aws4fetch`) (Phase 9 Part A).

### Deleted
- `dailyexpress-api/payout/payout-attempt.service.ts` — attempt table/service removed.
- `dailyexpress-api/notification/` (entire dir), `dailyexpress-api/db/notification-schema.ts`, `packages/api/src/hooks/notification.ts` — notification module + schema + hooks (Phase 8).
- `dailyexpress-api/workers/email.worker.ts` + `dailyexpress-api/mail/mail.service.ts` — pg-boss email consumer + raw-MIME SESv2 sender (Phase 9 Part A).

### Edited
- `dailyexpress-api/db/payout-schema.ts` — payout/earning schema (tripId, removed cols/enums, removed attempt table, 4-value payout_status).
- `dailyexpress-api/db/driver-schema.ts` — removed `inReviewPayments` from driver_stats.
- `dailyexpress-api/workers/boss.ts`, `job.service.ts`, `payout.worker.ts`, `driver-verification.worker.ts` — trip-keyed jobs, removed re-enqueue (Phase 8: verification worker is status-only). Phase 9 Part A: removed `enqueueEmail` (job.service) + `EMAIL_SEND`/`EMAIL_SEND_DLQ` queues (boss).
- `dailyexpress-api/payout/` — `payout.repository.ts`, `earning.service.ts`, `payout.service.ts`, `payout-processor.service.ts`, `payout-notification.service.ts`, `payout-webhook.service.ts` — immutable single-attempt flow (Phase 8: notification plumbing stripped from processor/settlement/webhook; `payout-notification.service.ts` is email-only). Phase 9 Part A: payout_failed dispatched post-commit via `sendEmailToQueue`.
- `dailyexpress-api/route/trip.service.ts` — re-completion guard + latest `payoutStatus` in `getDailyTripSummaries`.
- `dailyexpress-api/route/booking-finalizer.service.ts` — booking_confirmed dispatched post-commit (Phase 9 Part A).
- `dailyexpress-api/auth/auth.service.ts` — verify_otp/reset_password dispatched post-commit (Phase 9 Part A).
- `dailyexpress-api/admin/admin-trip.service.ts` — removed driver-assigned emails (both external + platform) (Phase 9 Part A).
- `dailyexpress-api/payment/payment-payout-refund.service.ts` + `workers/trip-refund.worker.ts` — refund/trip_cancelled emails dispatched post-commit; send methods `return EmailToSend | null` (Phase 9 Part A).
- `dailyexpress-api/driver/driver-stats.service.ts` + `driver/driver.service.ts` — removed manual_review + inReviewPayments.
- `dailyexpress-api/config/index.ts` — removed payout retry delay env vars; added optional Cloudflare queue/token vars (Phase 9 Part A).
- `dailyexpress-api/db/index.ts` + `dailyexpress-api/index.ts` — removed notification schema + routes/SSE mounts (Phase 8).
- `dailyexpress-api/driver/driver-profile.service.ts` — removed pending-verification notification creation (Phase 8).
- `shared/types/index.ts` + `packages/api/src/hooks/driver.ts` + `packages/api/src/hooks/booking.ts` — type cleanup + `payoutStatus` in trip summaries (Phase 8: shared notification/push types + unused zod import removed, `notificationApi` + hook export removed from packages/api).
- `apps/drivers/app/components/route/RouteCardItem.tsx`, `RouteCard.tsx`, `apps/drivers/app/lib/type.ts`, `apps/drivers/app/components/StatsCard.tsx`, `apps/drivers/app/components/PayoutTable.tsx` — retry button, hardcoded In Review, simplified status display.
