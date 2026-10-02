-- Allow multiple bookings per (origin, destination, date, user, departure) slot.
--
-- The unique index assumed a booking is never created twice for the same slot.
-- That is no longer true: each checkout inserts a fresh booking instead of
-- reusing an existing one, so the index now blocks legitimate re-booking.
--
-- Consequence: a user can hold several bookings on one departure and may pay
-- for more than one. Seat packing and earning derivation already handle
-- multiple bookings per trip (see assignBookingToTrip / upsertTripEarning).
--
-- Both names are dropped: local dev carried the non-partial name while 0035
-- created the partial one.

DROP INDEX IF EXISTS "booking_origin_destination_date_user_departure_idx";
DROP INDEX IF EXISTS "booking_origin_destination_date_user_departure_active_idx";