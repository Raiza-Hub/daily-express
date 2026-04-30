CREATE INDEX IF NOT EXISTS "pickup_location_locality_trgm_idx"
ON "route" USING gin ("pickup_location_locality" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "dropoff_location_locality_trgm_idx"
ON "route" USING gin ("dropoff_location_locality" gin_trgm_ops);

CREATE UNIQUE INDEX IF NOT EXISTS "route_driver_origin_destination_departure_unique_idx"
ON "route" (
  "driver_id",
  "pickup_location_title",
  "pickup_location_locality",
  "pickup_location_label",
  "dropoff_location_title",
  "dropoff_location_locality",
  "dropoff_location_label",
  "departure_time"
);
