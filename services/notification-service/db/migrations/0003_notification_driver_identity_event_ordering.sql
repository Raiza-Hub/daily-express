ALTER TABLE "driver_identity"
  ADD COLUMN IF NOT EXISTS "source_occurred_at" timestamp NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS "driver_identity_source_occurred_at_idx"
  ON "driver_identity" ("source_occurred_at");
