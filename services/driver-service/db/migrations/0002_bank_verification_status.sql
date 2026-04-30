CREATE TYPE "public"."bank_verification_status" AS ENUM('pending', 'active', 'failed');
ALTER TABLE "driver"
ADD COLUMN "bank_verification_status" "bank_verification_status" DEFAULT 'active' NOT NULL,
ADD COLUMN "bank_verification_failure_reason" text,
ADD COLUMN "bank_verification_requested_at" timestamp,
ADD COLUMN "bank_verified_at" timestamp;
