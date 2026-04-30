CREATE TABLE IF NOT EXISTS "driver_identity" (
  "driver_id" uuid PRIMARY KEY,
  "user_id" uuid NOT NULL UNIQUE,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "driver_identity_user_id_idx"
  ON "driver_identity" ("user_id");
