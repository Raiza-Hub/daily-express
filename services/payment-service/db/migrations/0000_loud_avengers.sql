CREATE TYPE "public"."payment_provider" AS ENUM('paystack');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('initialized', 'pending', 'successful', 'failed', 'cancelled', 'expired');--> statement-breakpoint
CREATE TABLE "payment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"booking_id" uuid,
	"provider" "payment_provider" DEFAULT 'paystack' NOT NULL,
	"reference" varchar(128) NOT NULL,
	"provider_transaction_id" varchar(128),
	"amount_minor" integer NOT NULL,
	"currency" varchar(8) DEFAULT 'NGN' NOT NULL,
	"product_name" text NOT NULL,
	"product_description" text NOT NULL,
	"customer_name" text,
	"customer_email" text,
	"customer_mobile" text,
	"status" "payment_status" DEFAULT 'initialized' NOT NULL,
	"provider_status" varchar(32),
	"checkout_url" text,
	"checkout_token" text,
	"redirect_url" text NOT NULL,
	"cancel_url" text,
	"channels" jsonb,
	"raw_initialize_response" jsonb,
	"raw_verification_response" jsonb,
	"metadata" jsonb,
	"last_status_check_at" timestamp,
	"paid_at" timestamp,
	"failed_at" timestamp,
	"failure_code" text,
	"failure_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "payment_reference_unique" UNIQUE("reference")
);
--> statement-breakpoint
CREATE TABLE "payment_webhook" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" "payment_provider" DEFAULT 'paystack' NOT NULL,
	"payment_reference" varchar(128),
	"event_type" varchar(64) DEFAULT 'paystack.event',
	"signature_valid" boolean DEFAULT false NOT NULL,
	"payload" jsonb NOT NULL,
	"verification_note" text,
	"processed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
