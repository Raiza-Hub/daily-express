-- Passenger table: one row per traveler on a booking.
--
-- Bookers are NOT auto-listed here; booking.user_id identifies the booker.
-- Each row is a traveler. A booking has 1-4 rows. No backfill — new table,
-- created against the new schema (owner directive, no historical data).
CREATE TABLE IF NOT EXISTS "passenger" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "booking_id" uuid NOT NULL REFERENCES "booking"("id") ON DELETE restrict,
  "full_name" text NOT NULL,
  "email" text NOT NULL,
  "phone" varchar(20) NOT NULL,
  "carries_luggage" boolean DEFAULT false NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "passenger_booking_idx" ON "passenger" ("booking_id");