CREATE TYPE "notification_tone" AS ENUM (
  'critical',
  'attention',
  'positive',
  'info'
);

CREATE TYPE "notification_kind" AS ENUM (
  'event',
  'state'
);

CREATE TABLE "notification" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "driver_id" uuid NOT NULL,
  "notification_key" varchar(191) NOT NULL,
  "kind" "notification_kind" NOT NULL DEFAULT 'event',
  "type" varchar(96) NOT NULL,
  "title" text NOT NULL,
  "message" text NOT NULL,
  "href" text,
  "tag" varchar(64) NOT NULL,
  "tone" "notification_tone" NOT NULL DEFAULT 'info',
  "metadata" jsonb,
  "content_hash" varchar(128) NOT NULL,
  "read_at" timestamp,
  "occurred_at" timestamp NOT NULL DEFAULT now(),
  "archived_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE "consumed_event" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "event_id" varchar(128) NOT NULL UNIQUE,
  "topic" varchar(128) NOT NULL,
  "processed_at" timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX "notification_driver_key_unique"
  ON "notification" ("driver_id", "notification_key");

CREATE INDEX "notification_driver_occurred_at_idx"
  ON "notification" ("driver_id", "occurred_at");

CREATE INDEX "notification_driver_read_at_idx"
  ON "notification" ("driver_id", "read_at");
