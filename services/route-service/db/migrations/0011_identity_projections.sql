CREATE TABLE "driver_identity" (
  "driver_id" uuid PRIMARY KEY NOT NULL,
  "user_id" uuid NOT NULL,
  "first_name" text NOT NULL,
  "last_name" text NOT NULL,
  "phone" text NOT NULL,
  "profile_picture_url" text,
  "country" text NOT NULL,
  "state" text NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "source_occurred_at" timestamp NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "driver_identity_user_id_unique" UNIQUE("user_id")
);

CREATE INDEX "driver_identity_user_id_idx"
  ON "driver_identity" ("user_id");

CREATE INDEX "driver_identity_source_occurred_at_idx"
  ON "driver_identity" ("source_occurred_at");

CREATE TABLE "passenger_identity" (
  "user_id" uuid PRIMARY KEY NOT NULL,
  "first_name" text NOT NULL,
  "last_name" text NOT NULL,
  "email" text NOT NULL,
  "source_occurred_at" timestamp NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX "passenger_identity_email_idx"
  ON "passenger_identity" ("email");

CREATE INDEX "passenger_identity_source_occurred_at_idx"
  ON "passenger_identity" ("source_occurred_at");

CREATE TABLE "consumed_event" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "event_id" varchar(128) NOT NULL,
  "topic" varchar(128) NOT NULL,
  "processed_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "consumed_event_event_id_unique" UNIQUE("event_id")
);

CREATE INDEX "consumed_event_topic_processed_at_idx"
  ON "consumed_event" ("topic", "processed_at" DESC);
