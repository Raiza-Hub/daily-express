CREATE TABLE IF NOT EXISTS "zone" (
	"id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
	"name" text NOT NULL UNIQUE,
	"fee" bigint NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "route" ADD COLUMN "zone_id" uuid REFERENCES "zone"("id") ON DELETE set null;--> statement-breakpoint
ALTER TABLE "booking" ADD COLUMN "fee_amount" bigint DEFAULT 0 NOT NULL;
