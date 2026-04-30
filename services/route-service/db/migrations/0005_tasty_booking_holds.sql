CREATE TYPE "public"."booking_hold_status" AS ENUM('active', 'confirmed', 'released', 'expired');--> statement-breakpoint
CREATE TABLE "booking_hold" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"route_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"trip_date" timestamp NOT NULL,
	"payment_reference" varchar(128) NOT NULL,
	"status" "booking_hold_status" DEFAULT 'active' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "booking_hold_payment_reference_unique" UNIQUE("payment_reference")
);--> statement-breakpoint
CREATE UNIQUE INDEX "booking_hold_payment_reference_idx" ON "booking_hold" USING btree ("payment_reference");--> statement-breakpoint
CREATE INDEX "booking_hold_route_trip_date_idx" ON "booking_hold" USING btree ("route_id","trip_date");--> statement-breakpoint
CREATE INDEX "booking_hold_status_expires_idx" ON "booking_hold" USING btree ("status","expires_at");
