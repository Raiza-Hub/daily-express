# Route module scenarios

Module: `dailyexpress-api/route`

Route owns driver route CRUD, public route search, trip status changes, booking
creation, checkout booking creation, user booking lookup, trip booking lookup,
and driver trip summaries.

## Main routes

- `GET /api/v1/route/driver/routes`
- `POST /api/v1/route/create/driver/route`
- `PUT /api/v1/route/update/driver/route/:id`
- `DELETE /api/v1/route/driver/route/:id`
- `PATCH /api/v1/route/driver/trip/:id`
- `GET /api/v1/route/driver/trips-summary-range`
- `GET /api/v1/route/driver/trip/:tripId/bookings`
- `GET /api/v1/route/search`
- `GET /api/v1/route/user/bookings`
- `GET /api/v1/route/user/bookings/search`
- `POST /api/v1/route/user/booking`
- `POST /api/v1/route/user/booking/checkout`

## Success

- Driver route create resolves the authenticated driver, checks duplicates, and
  inserts the route while incrementing `driverStats.activeRoutes` in one
  transaction.
- Driver route update checks ownership, prevents duplicate route identity, and
  updates the route.
- Driver route delete checks ownership, deletes the route, and decrements active
  route stats in one transaction.
- Public search validates `from`, `to`, date, and vehicle type, scores active
  routes with normalized fuzzy matching, filters by trip-date remaining seats,
  and returns route/driver response objects.
- Trip status update checks trip ownership and writes the new trip status. For
  statuses other than `booking_closed`, related bookings are updated to the same
  status. Completed trips release payout earnings and enqueue payout jobs inside
  the transaction, create a notification row, then publish realtime after commit.
  Cancelled trips cancel earnings, create a cancellation notification, then
  publish realtime after commit.
- User booking list returns visible confirmed/completed bookings whose payment
  status is not failed, cancelled, or expired.
- Booking search returns the user booking matching payment reference, last name,
  and confirmed status.
- Trip bookings returns confirmed bookings for a driver-owned trip and includes
  passenger data.
- Checkout booking creates or finds the trip for a business date, reserves a
  seat, inserts or reuses a pending booking, upserts the payment hold, and
  schedules the payment expiry job in the same transaction. It returns booking,
  fare amount, currency, and expiry.

## Failure

- Missing auth on protected routes returns `401`.
- Missing route/trip IDs or invalid dates return `400`.
- Missing driver returns `404`.
- Duplicate route create/update returns `400`.
- Unauthorized route/trip update or delete returns `403`.
- Missing route or trip returns `404`.
- Public search missing `from`, `to`, or date returns `400`.
- Invalid vehicle type returns `400`.
- Closed/inactive routes or trips return `400` during booking.
- Past departures return `400`.
- Full trips return `400`.
- Existing confirmed booking for the same trip returns `409`.
- Booking search miss returns `404`.

## Error

- Database uniqueness races are converted to controlled duplicate/active booking
  errors when they match known constraints.
- Unknown DB, transaction, realtime, payout helper, payment hold, or stats errors
  bubble to the global error handler.
- Seat reservation, booking insert, hold upsert, and expiry job insertion happen
  inside one transaction, so a failure rolls the reservation back.
