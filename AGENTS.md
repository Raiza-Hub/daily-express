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
- Fix slow tab switching in settings pages and reduce unnecessary network requests from navbar-mounted hooks in the drivers app.

## Constraints & Preferences
- Route-based navigation (separate URLs per settings tab) must be preserved; no conversion to client-side tabs.
- Use the existing `Loader` component (SpinnerIcon from @phosphor-icons/react) for loading states — not plain text.
- Use TanStack Query (React Query v5) options `staleTime` and `refetchOnMount` to prevent unnecessary refetches.
- Changes to shared hooks in `packages/api` affect both `apps/drivers` and `apps/web`.

## Progress
### Done
1. **Created `apps/drivers/app/(main)/settings/loading.tsx`** — uses the existing `Loader` component with `SpinnerIcon`. Shows instantly during navigation between settings tabs (Next.js Suspense boundary for the layout's children).
2. **Added `prefetch={true}` to `SettingTabs.tsx`** — each `<Link>` now prefetches the full page shell (RSC payload + JS bundles) on hover, making navigation near-instant.
3. **Added `staleTime: 5 * 60 * 1000` + `refetchOnMount: false` to `useGetDriver`** in `packages/api/src/hooks/driver.ts` — prevents unnecessary refetches from always-mounted navbar components (UserAccountNav, NotificationInbox, PostHogProviders).
4. **Added `staleTime: 5 * 60 * 1000` + `refetchOnMount: false` to `useGetMe`** in `packages/api/src/hooks/auth.ts` — prevents refetches from always-mounted web Navbar.
5. **Added `staleTime: 30_000` + `refetchOnMount: false` to `useDriverNotifications` and `useDriverNotificationsInfinite`** in `packages/api/src/hooks/notification.ts` — prevents refetches on tab switch for the notification inbox.
6. **Typecheck passed for `@repo/api`** — `npm run check-types` confirms all changes compile (only pre-existing error in `@repo/ui` unrelated).

### In Progress
- (none)

### Blocked
- (none)

## Key Decisions
- **Use `loading.tsx` at `settings/` level (not per-page)** — A single `loading.tsx` at the same segment as `settings/layout.tsx` provides a Suspense boundary for all settings sub-routes (profile, accounts, bank-details). Layout persists during navigation, tabs stay interactive.
- **`prefetch={true}` on all 3 tab links** — Prefetches dynamic page content (not just app shell), eliminates the remaining delay between click and content display.
- **`staleTime: 5 * 60 * 1000` for `useGetDriver` and `useGetMe`** — Driver and user profile data changes infrequently. 5-minute freshness prevents refetches on tab switch and window focus while the user is actively using the app.
- **`staleTime: 30_000` for notification hooks** — Unread badge count needs reasonable freshness but doesn't need refetching on every window focus. 30-second threshold is a good balance.
- **`refetchOnMount: false` for all 4 hooks** — Safe because: (1) mutations that need fresh data call `refetch()`/`invalidateQueries()` directly which bypasses this option, (2) `refetchInterval: 5000` for pending bank verification still fires regardless, (3) once `staleTime` expires, the next mount/window-focus triggers a normal refetch.
- **Did NOT convert to client-side tabs** — Team already has the `AnimatePresence` pattern in `TripDetailsSheet.tsx` (apps/web), but the `loading.tsx` + prefetch approach is simpler and matches the preference to keep route-based navigation.
- **Did NOT implement Parallel Routes** — Overengineered for 3 simple tabs; requires `default.tsx` slots at every URL, all 3 slots mount on initial load (3x data), and adds URL routing complexity.

## Next Steps
- Monitor for any lingering slow tab switches in production
- Consider adding `staleTime` to other frequently-remounting query hooks if needed

## Relevant Files
- `apps/drivers/app/(main)/settings/loading.tsx` — **CREATED** — Loading spinner shown during settings tab navigation.
- `apps/drivers/app/components/settings/SettingTabs.tsx` — **EDITED** — Added `prefetch={true}` to all 3 tab `<Link>` components.
- `packages/api/src/hooks/driver.ts` — **EDITED** — `useGetDriver`: added `staleTime: 5 * 60 * 1000` + `refetchOnMount: false`.
- `packages/api/src/hooks/auth.ts` — **EDITED** — `useGetMe`: added `staleTime: 5 * 60 * 1000` + `refetchOnMount: false`.
- `packages/api/src/hooks/notification.ts` — **EDITED** — `useDriverNotifications` and `useDriverNotificationsInfinite`: added `staleTime: 30_000` + `refetchOnMount: false`.
