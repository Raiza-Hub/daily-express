CREATE TYPE "public"."kyc_status" AS ENUM('none', 'pending', 'active', 'failed');--> statement-breakpoint
ALTER TABLE "route" ALTER COLUMN "departure_time" SET DATA TYPE time;--> statement-breakpoint
ALTER TABLE "route" ALTER COLUMN "arrival_time" SET DATA TYPE time;--> statement-breakpoint
ALTER TABLE "driver" ADD COLUMN "kyc_status" "kyc_status" DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "driver" ADD COLUMN "kyc_type" text;--> statement-breakpoint
ALTER TABLE "driver" ADD COLUMN "kyc_verification_reference" text;--> statement-breakpoint
ALTER TABLE "driver" ADD COLUMN "kyc_failure_reason" text;--> statement-breakpoint
ALTER TABLE "driver" ADD COLUMN "kyc_requested_at" timestamp;--> statement-breakpoint
ALTER TABLE "driver" ADD COLUMN "kyc_verified_at" timestamp;