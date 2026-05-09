# Notification module scenarios

Module: `dailyexpress-api/notification`

Notification owns driver notification rows, listing, unread filtering, read
state, managed bank-verification state notifications, and Upstash Realtime
publishing.

## Main routes

- `GET /api/v1/notifications`
- `PATCH /api/v1/notifications/:id/read`
- `POST /api/v1/notifications/read-all`

## Success

- List notifications resolves the current user to a driver, clamps limit to
  `1..50`, applies optional unread filtering and cursor pagination, excludes
  archived rows, orders by `occurredAt desc, createdAt desc`, and returns
  `notifications` plus `nextCursor`.
- Mark read checks driver ownership and archived state. If unread, it updates
  `readAt` and publishes `notification.read`. If already read, it returns the
  existing notification without republishing.
- Mark all read updates all unread active notifications for the driver and
  publishes `notification.read_all` only when at least one row changed.
- Event notification creation upserts by `(driverId, notificationKey)`, resets
  `readAt`, unarchives the row, and returns the serialized notification.
- Managed bank verification state archives stale bank-state notifications,
  upserts the current state, resets `readAt` only when content changed or the row
  was archived, and returns `{ notification, shouldDeliver }`.
- Realtime events publish to `driver:{driverId}` with event types
  `notification.created`, `notification.read`, and `notification.read_all`.

## Failure

- Missing auth returns `401`.
- Missing notification ID returns `400`.
- Missing driver returns empty list for reads, and `404` for operations that must
  resolve a driver.
- Marking a missing, other-driver, or archived notification returns `404`.
- Recreating the same bank-verification state with unchanged content returns
  `shouldDeliver = false`, so callers do not republish stale state.

## Error

- DB, transaction, serialization, and Upstash Realtime errors bubble through the
  controller or caller.
- Realtime publish occurs after DB writes. If realtime fails, the source-of-truth
  notification row remains saved.
