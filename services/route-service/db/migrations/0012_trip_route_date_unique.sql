CREATE UNIQUE INDEX IF NOT EXISTS "trip_route_date_unique_idx"
ON "trip" ("route_id", "date");
