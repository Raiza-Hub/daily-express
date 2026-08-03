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

### In Progress
- (none)

### Blocked
- (none)

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

## Relevant Files
### Created
- `dailyexpress-api/db/migrations/0014_aggregate_payouts_per_trip.sql` — Migration: payout column drops/adds, index swaps, `driver_stats` column drop, `earning_status` enum drop-value note.
- `dailyexpress-api/db/migrations/0015_immutable_payouts.sql` — Migration: drop unique/retry indexes, drop `payout_attempt`, drop retry columns, `permanent_failed → failed`, `payout_status` enum type-swap.
- `dailyexpress-api/payout/payout-settlement.service.ts` — `verifyWithProvider` + `finalizePayout` (replaces `payout-attempt.service.ts`).

### Deleted
- `dailyexpress-api/payout/payout-attempt.service.ts` — attempt table/service removed.

### Edited
- `dailyexpress-api/db/payout-schema.ts` — payout/earning schema (tripId, removed cols/enums, removed attempt table, 4-value payout_status).
- `dailyexpress-api/db/driver-schema.ts` — removed `inReviewPayments` from driver_stats.
- `dailyexpress-api/workers/boss.ts`, `job.service.ts`, `payout.worker.ts`, `driver-verification.worker.ts` — trip-keyed jobs, removed re-enqueue.
- `dailyexpress-api/payout/` — `payout.repository.ts`, `earning.service.ts`, `payout.service.ts`, `payout-processor.service.ts`, `payout-notification.service.ts`, `payout-webhook.service.ts` — immutable single-attempt flow.
- `dailyexpress-api/route/trip.service.ts` — re-completion guard + latest `payoutStatus` in `getDailyTripSummaries`.
- `dailyexpress-api/driver/driver-stats.service.ts` + `driver/driver.service.ts` — removed manual_review + inReviewPayments.
- `dailyexpress-api/config/index.ts` — removed payout retry delay env vars.
- `shared/types/index.ts` + `packages/api/src/hooks/driver.ts` + `packages/api/src/hooks/booking.ts` — type cleanup + `payoutStatus` in trip summaries.
- `apps/drivers/app/components/route/RouteCardItem.tsx`, `RouteCard.tsx`, `apps/drivers/app/lib/type.ts`, `apps/drivers/app/components/StatsCard.tsx`, `apps/drivers/app/components/PayoutTable.tsx` — retry button, hardcoded In Review, simplified status display.
