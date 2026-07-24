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
- Implement zone-based dynamic transaction fees: different departure terminals have different fees, replacing the hardcoded ₦1,000 flat fee.

## Constraints & Preferences
- Route-based navigation (separate URLs per settings tab) must be preserved; no conversion to client-side tabs.
- Use the existing `Loader` component (SpinnerIcon from @phosphor-icons/react) for loading states — not plain text.
- Use TanStack Query (React Query v5) options `staleTime` and `refetchOnMount` to prevent unnecessary refetches.
- Changes to shared hooks in `packages/api` affect both `apps/drivers` and `apps/web`.

## Progress
### Done
1. **Zone-based transaction fee feature implemented** — full-stack, end-to-end.
2. **Zone CRUD API** at `/api/v1/admin/zones` — GET, POST, PUT, DELETE with admin auth.
3. **Database**: new `zone` table, `zone_id` FK on `route`, `feeAmount` column on `booking`.
4. **Backend**: booking creation stores zone fee, payment charges fare + fee, refunds include fee.
5. **Frontend**: `TRANSACTION_FEE = 1000` constant removed, replaced by zone fee from API.

### In Progress
- (none)

### Blocked
- (none)

## Key Decisions
- **Zone = departure terminal** — Each zone represents a physical departure point (e.g., "Funaab Terminal", "Asero Park"). Single fee per zone, not per vehicle type.
- **`feeAmount` stored on `booking`** — Captures the fee at booking time so historical bookings aren't affected by later zone fee changes. Enables accurate refunds and display before payment.
- **`calculateTrustedChargeAmount(fareAmount, feeAmount)`** — Updated signature takes fee as second param (was hardcoded to 0).
- **Earnings unchanged** — Driver still gets 100% of `fareAmount`. The fee is an additional charge on the passenger, not deducted from the driver.
- **Zone routes under admin** — `/api/v1/admin/zones` inherits admin auth middleware from the existing admin router.
- **Relational queries for `findTripWithRoute`** — Uses Drizzle's `db.query.trip.findFirst({ with: { route: { with: { zone: true } } } })` with manual reshaping to `{ trip, route }` to match existing caller expectations.
- **No seed script** — Zones are created via admin API. Initial zones should be set up by the admin.

## Relevant Files
### Created
- `dailyexpress-api/db/zone-schema.ts` — Zone Drizzle schema + relations.
- `dailyexpress-api/db/migrations/0002_add_zone_booking_fee.sql` — Migration: zone table, route.zone_id, booking.fee_amount.
- `dailyexpress-api/zone/zone.service.ts` — Zone CRUD service.
- `dailyexpress-api/zone/zone.api.ts` — Zone API routes (admin-only).

### Edited
- `dailyexpress-api/db/route-schema.ts` — Added `zoneId` to route, `feeAmount` to booking, zone relation.
- `dailyexpress-api/db/index.ts` — Exports zone schema.
- `dailyexpress-api/route/route.repository.ts` — `findRouteById`/`findAllRoutes` include zone via relational query. `findTripWithRoute` uses `db.query.trip.findFirst` with nested zone.
- `dailyexpress-api/route/route-crud.service.ts` — Accepts `zoneId` in route updates.
- `dailyexpress-api/route/search.service.ts` — Joins zone table, returns zone fee with search results.
- `dailyexpress-api/route/booking.service.ts` — Looks up zone fee on booking creation, stores `feeAmount`, returns it in responses.
- `dailyexpress-api/utils/payment.ts` — `calculateTrustedChargeAmount(fareAmount, feeAmount)` signature updated.
- `dailyexpress-api/payment/payment.repository.ts` — `findBookingFareByBookingId` returns `feeAmount`.
- `dailyexpress-api/payment/payment-init.service.ts` — Passes `feeAmount` to charge calculation.
- `dailyexpress-api/payment/payment-payout-refund.service.ts` — Refunds `fareAmount + feeAmount`.
- `dailyexpress-api/admin/admin.routes.ts` — Mounts zone routes under `/zones`.
- `shared/types/index.ts` — Added `Zone` interface, `zoneId`/`zone` on Route, `feeAmount` on Booking.
- `packages/types/routeSchema.ts` — Added optional `zoneId` to route schema.
- `packages/api/src/hooks/booking.ts` — Added `feeAmount` to `UserBookingWithTrip`.
- `apps/web/app/lib/type.ts` — Added `zoneFee` to `SearchTrip`, `feeAmount` to `TripStatusItem`.
- `apps/web/app/lib/utils.ts` — `toSearchTrip` maps `zone.fee` to `zoneFee`. `transformToTripStatusItem` maps `feeAmount`.
- `apps/web/app/components/trip/TripCardItem.tsx` — Removed `TRANSACTION_FEE = 1000`, uses `item.zoneFee`.
- `apps/web/app/components/trip/TripStatusCardItem.tsx` — Removed `TRANSACTION_FEE = 1000`, uses `item.feeAmount`.