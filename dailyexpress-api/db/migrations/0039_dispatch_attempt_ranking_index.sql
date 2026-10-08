CREATE INDEX IF NOT EXISTS "driver_dispatch_attempt_driver_created_idx"
ON "driver_dispatch_attempt" USING btree ("driver_id", "created_at");
