CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "pickup_location_title_trgm_idx" ON "route" USING gin ("pickup_location_title" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "pickup_location_label_trgm_idx" ON "route" USING gin ("pickup_location_label" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "dropoff_location_title_trgm_idx" ON "route" USING gin ("dropoff_location_title" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "dropoff_location_label_trgm_idx" ON "route" USING gin ("dropoff_location_label" gin_trgm_ops);
