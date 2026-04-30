CREATE UNIQUE INDEX IF NOT EXISTS "booking_trip_id_user_id_active_idx"
ON "booking" ("trip_id", "user_id")
WHERE "status" IN ('pending', 'confirmed');
