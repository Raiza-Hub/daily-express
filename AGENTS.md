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
- Fix payout FK violation where recipient_id was set to driver.id instead of payout_recipient.id, causing the payout worker to crash silently

## Constraints & Preferences
- Use booking firstName/lastName (not users table or paymentRecord.customerName) for email name lookup
- tx is always passed at call sites, so make it required
- Const capture (const pending = pendingRefund) to fix TS closure narrowing, not null assertions
- Tab content should animate on switch without unmounting; use forceMount with AnimatePresence
- For image preloading, use React 19 preload() from react-dom on mouse enter (intent-based), not head preload links
- Do not include seed scripts in commits
- When driver is not payout-ready, create a notification for the driver instead of throwing

## Progress
### Done
- Added Framer Motion animation (fade+slide, 150ms) on tab switch in TripDetailsSheet.tsx using single AnimatePresence mode="wait" replacing TabsContent
- Refactored tab animation to use directional slide with Variants, useMeasure for height smoothing, and scroll container ref
- Changed TripCancelledEmail.tsx and RefundFailedEmail.tsx greeting fallback: customerName || customerEmail → customerName || "Valued Customer"
- Added booking name lookup (firstName + lastName) in sendRefundFailureEmail and sendTripCancelledEmail via tx.query.booking.findFirst
- Made tx: PaymentTransaction required in both methods and removed dead if (tx)/else branches
- Fixed TS error "pendingRefund is possibly null" in refundConfirmedBooking by capturing const pending = pendingRefund
- Fixed cancelled-trip bookings hidden on trip-status page: changed ne(trip.status, "cancelled") to or(ne(trip.status, "cancelled"), inArray(booking.paymentStatus, ["refund_pending", "refunded", "refund_failed"]))
- Fixed driver status image not showing in TripDetailsSheet: added driverStatus prop to TripDetailsSheet call in TripStatusCardItem.tsx
- Added intent-based image preloading in TripStatusCardItem.tsx: preload() from react-dom on onMouseEnter with fetchPriority: "low"
- Fixed SSE notifications not streaming on first connect: removed isFirstOpen guard in useDriverNotificationsSSE.ts
- Added KYC verification notification support: renamed BANK_VERIFICATION_NOTIFICATION_KEYS to BANK_VERIFICATION_STATE_KEYS, added KYC_VERIFICATION_STATE_KEYS
- Added IntersectionObserver infinite scroll to NotificationInbox.tsx, PayoutTable.tsx, TripStatusCard.tsx
- Changed payout backend to cursor-based pagination
- Fixed missing lt import in payout.repository.ts
- Fixed payout FK violation: restructured processEarningPayout to get driver/recipient before creating payout, removed fallback recipient creation
- Replaced throw on incomplete driver profile with a driver notification via notificationService
- Added auto-retry of blocked payout on bank verification success: driver-verification.worker.ts queries the archived "account-setup-pending" notification for earningId metadata and enqueues a payout for that specific earning

### In Progress
- (none)

### Blocked
- (none)

## Key Decisions
- Tab animation: single AnimatePresence mode="wait" with keyed motion.div; directional slide + height smoothing via useMeasure
- Email name source: query booking.firstName + booking.lastName via tx (not users table)
- Make tx required since all call sites always pass it
- Cancelled-trip booking visibility: or() condition to show refund-related payment statuses
- Image preloading: React 19 preload() on hover intent vs head preload links
- SSE first-connect invalidation: always invalidate on open
- Infinite scroll: IntersectionObserver with sentinel element
- Payout pagination: cursor-based (not offset)
- Incomplete driver: notification instead of throw/silent fail

## Next Steps
- Deploy the fix to Railway
- Re-enqueue the stuck payout job 883a56ce (earning cf14630c, trip dcaa2950-0d3d-4494-a1bb-d44fc14f454a) or delete the DLQ job
