-- Driver dispatch and IVR state. This migration deliberately does not persist
-- a cancellation reason: cancellation remains a trip/booking state only.
--
-- Does NOT touch booking_status. Migration 0042 collapses that enum to
-- ('pending','confirmed'); re-adding 'cancelled' here would reintroduce a value
-- the Drizzle schema does not model and that no code writes.

ALTER TABLE driver DROP COLUMN IF EXISTS last_assigned_at;

CREATE TYPE trip_dispatch_status AS ENUM ('pending', 'searching', 'assigned', 'cancelled');
CREATE TYPE driver_dispatch_attempt_status AS ENUM (
  'dialing',
  'awaiting_dtmf',
  'accepted',
  'declined',
  'unavailable'
);

CREATE TABLE trip_dispatch (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES trip(id) ON DELETE CASCADE,
  status trip_dispatch_status NOT NULL DEFAULT 'pending',
  deadline_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX trip_dispatch_trip_id_unique_idx ON trip_dispatch (trip_id);
CREATE INDEX trip_dispatch_status_deadline_idx ON trip_dispatch (status, deadline_at);

CREATE TABLE driver_dispatch_attempt (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_id uuid NOT NULL REFERENCES trip_dispatch(id) ON DELETE CASCADE,
  driver_id uuid NOT NULL REFERENCES driver(id) ON DELETE RESTRICT,
  client_request_id uuid NOT NULL,
  status driver_dispatch_attempt_status NOT NULL DEFAULT 'dialing',
  retry_number integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Resolves the attempt from the clientRequestId AT echoes on every voice callback.
CREATE UNIQUE INDEX driver_dispatch_attempt_client_request_unique_idx
  ON driver_dispatch_attempt (client_request_id);

-- At most one live offer per dispatch, and at most one live call per driver.
CREATE UNIQUE INDEX driver_dispatch_attempt_active_dispatch_unique_idx
  ON driver_dispatch_attempt (dispatch_id)
  WHERE status IN ('dialing', 'awaiting_dtmf');
CREATE UNIQUE INDEX driver_dispatch_attempt_active_driver_unique_idx
  ON driver_dispatch_attempt (driver_id)
  WHERE status IN ('dialing', 'awaiting_dtmf');