ALTER TYPE "payment_status" ADD VALUE IF NOT EXISTS 'refund_pending';
--> statement-breakpoint
ALTER TYPE "payment_status" ADD VALUE IF NOT EXISTS 'refunded';
--> statement-breakpoint
ALTER TYPE "payment_status" ADD VALUE IF NOT EXISTS 'refund_failed';
--> statement-breakpoint
ALTER TABLE "booking_projection"
  ADD COLUMN IF NOT EXISTS "pg_boss_job_id" text;
--> statement-breakpoint
ALTER TABLE "booking_projection"
  ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "booking_projection_booking_id_idx"
  ON "booking_projection" ("booking_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_reference_status_idx"
  ON "payment" ("reference", "status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "outbox_events_aggregate_event_idx"
  ON "outbox_events" ("aggregate_id", "event_type");
