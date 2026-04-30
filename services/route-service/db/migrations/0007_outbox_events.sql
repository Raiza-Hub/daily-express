-- Migration: Add outbox_events table for Kafka outbox pattern
-- Service: route-service

CREATE TABLE IF NOT EXISTS "outbox_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL UNIQUE,
	"aggregate_type" text NOT NULL,
	"aggregate_id" text NOT NULL,
	"event_type" text NOT NULL,
	"event_version" integer DEFAULT 1,
	"payload" jsonb NOT NULL,
	"headers" jsonb,
	"trace_id" text,
	"span_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"processing_started_at" timestamp,
	"published_at" timestamp,
	"status" text DEFAULT 'PENDING',
	"retry_count" integer DEFAULT 0,
	"next_retry_at" timestamp,
	"last_error" text,
	"locked_at" timestamp,
	"locked_by" text
);

CREATE INDEX IF NOT EXISTS "outbox_lookup_idx" ON "outbox_events" ("status", "next_retry_at", "created_at");
CREATE INDEX IF NOT EXISTS "outbox_published_idx" ON "outbox_events" ("published_at");