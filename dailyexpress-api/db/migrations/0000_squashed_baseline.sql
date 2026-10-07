-- Squashed baseline (replaces the deleted 0000-0043 migration history).
-- FRESH DATABASES ONLY: prod already has these objects and migrations there are applied manually.
CREATE TYPE "public"."driver_dispatch_attempt_status" AS ENUM('dialing', 'awaiting_dtmf', 'accepted', 'declined', 'unavailable');--> statement-breakpoint
CREATE TYPE "public"."trip_dispatch_status" AS ENUM('pending', 'searching', 'assigned', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."bank_verification_status" AS ENUM('active', 'failed');--> statement-breakpoint
CREATE TYPE "public"."kyc_status" AS ENUM('active', 'failed');--> statement-breakpoint
CREATE TYPE "public"."transaction_status" AS ENUM('pending', 'successful', 'failed');--> statement-breakpoint
CREATE TYPE "public"."payout_provider" AS ENUM('kora');--> statement-breakpoint
CREATE TYPE "public"."payout_status" AS ENUM('pending', 'successful', 'failed');--> statement-breakpoint
CREATE TYPE "public"."booking_status" AS ENUM('pending', 'confirmed');--> statement-breakpoint
CREATE TYPE "public"."status" AS ENUM('inactive', 'pending', 'active');--> statement-breakpoint
CREATE TYPE "public"."trip_status" AS ENUM('cancelled', 'completed', 'awaiting_driver');--> statement-breakpoint
CREATE TABLE "admin_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"action" text NOT NULL,
	"admin_email" text NOT NULL,
	"target" text,
	"details" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_providers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"provider_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text NOT NULL,
	"date_of_birth" timestamp NOT NULL,
	"email_verified" boolean NOT NULL,
	"referral" text,
	"profile_picture_url" text,
	"phone" text,
	"gender" text,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "driver_dispatch_attempt" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dispatch_id" uuid NOT NULL,
	"driver_id" uuid NOT NULL,
	"client_request_id" uuid NOT NULL,
	"status" "driver_dispatch_attempt_status" DEFAULT 'dialing' NOT NULL,
	"retry_number" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trip_dispatch" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"status" "trip_dispatch_status" DEFAULT 'pending' NOT NULL,
	"deadline_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "driver" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text NOT NULL,
	"profile_picture" text,
	"phone" text NOT NULL,
	"country" text NOT NULL,
	"currency" text NOT NULL,
	"state" text NOT NULL,
	"city" text NOT NULL,
	"address" text NOT NULL,
	"bank_name" text,
	"bank_code" text,
	"account_number" text,
	"account_name" text,
	"bank_verification_status" "bank_verification_status",
	"kyc_status" "kyc_status",
	"kyc_type" text,
	"kyc_id" text,
	"kyc_verification_reference" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "driver_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "driver_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "passenger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"full_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" varchar(20) NOT NULL,
	"carries_luggage" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"booking_id" uuid,
	"reference" varchar(128) NOT NULL,
	"amount" bigint NOT NULL,
	"currency" varchar(8) DEFAULT 'NGN' NOT NULL,
	"product_name" text NOT NULL,
	"customer_email" text,
	"status" "transaction_status" DEFAULT 'pending' NOT NULL,
	"refund_id" uuid,
	"payer_bank_name" text,
	"payer_account_number" varchar(32),
	"payer_account_name" text,
	"checkout_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "payment_reference_unique" UNIQUE("reference")
);
--> statement-breakpoint
CREATE TABLE "refund" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid NOT NULL,
	"reference" varchar(128) NOT NULL,
	"amount" bigint NOT NULL,
	"currency" varchar(8) DEFAULT 'NGN' NOT NULL,
	"status" "transaction_status" DEFAULT 'pending' NOT NULL,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "refund_reference_unique" UNIQUE("reference")
);
--> statement-breakpoint
CREATE TABLE "earning" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"amount" bigint NOT NULL,
	"currency" varchar(8) DEFAULT 'NGN' NOT NULL,
	"payout_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payout" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"driver_id" uuid NOT NULL,
	"trip_id" uuid,
	"recipient_bank_name" text,
	"recipient_account_last4" varchar(4),
	"reference" varchar(128) NOT NULL,
	"provider" "payout_provider" DEFAULT 'kora' NOT NULL,
	"amount" bigint NOT NULL,
	"currency" varchar(8) DEFAULT 'NGN' NOT NULL,
	"status" "payout_status" DEFAULT 'pending' NOT NULL,
	"driver_email" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "payout_reference_unique" UNIQUE("reference")
);
--> statement-breakpoint
CREATE TABLE "booking" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"origin_id" uuid NOT NULL,
	"destination_id" uuid NOT NULL,
	"trip_date" date NOT NULL,
	"departure_time" time NOT NULL,
	"luggage_count" integer DEFAULT 0 NOT NULL,
	"trip_id" uuid,
	"user_id" uuid NOT NULL,
	"total_amount" bigint DEFAULT 0 NOT NULL,
	"total_fee" bigint DEFAULT 0 NOT NULL,
	"currency" varchar(8) DEFAULT 'NGN' NOT NULL,
	"status" "booking_status" DEFAULT 'pending' NOT NULL,
	"payment_reference" varchar(128),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "destination" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"locality" text NOT NULL,
	"status" "status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "origin" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"locality" text NOT NULL,
	"meeting_point" text NOT NULL,
	"departure_time" time[] NOT NULL,
	"price" bigint NOT NULL,
	"fee" bigint NOT NULL,
	"luggage_fee" bigint NOT NULL,
	"destination_ids" uuid[] NOT NULL,
	"status" "status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trip" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"origin_id" uuid NOT NULL,
	"destination_id" uuid NOT NULL,
	"driver_id" uuid,
	"date" date NOT NULL,
	"departure_time" time NOT NULL,
	"capacity" integer NOT NULL,
	"booked_seats" integer DEFAULT 0 NOT NULL,
	"status" "trip_status" DEFAULT 'awaiting_driver' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "trip_booked_seats_not_over_capacity_check" CHECK ("trip"."booked_seats" <= "trip"."capacity")
);
--> statement-breakpoint
ALTER TABLE "user_providers" ADD CONSTRAINT "user_providers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_dispatch_attempt" ADD CONSTRAINT "driver_dispatch_attempt_dispatch_id_trip_dispatch_id_fk" FOREIGN KEY ("dispatch_id") REFERENCES "public"."trip_dispatch"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_dispatch_attempt" ADD CONSTRAINT "driver_dispatch_attempt_driver_id_driver_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."driver"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_dispatch" ADD CONSTRAINT "trip_dispatch_trip_id_trip_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trip"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver" ADD CONSTRAINT "driver_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passenger" ADD CONSTRAINT "passenger_booking_id_booking_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."booking"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_booking_id_booking_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."booking"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_refund_id_refund_id_fk" FOREIGN KEY ("refund_id") REFERENCES "public"."refund"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund" ADD CONSTRAINT "refund_payment_id_payment_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payment"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "earning" ADD CONSTRAINT "earning_trip_id_trip_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trip"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "earning" ADD CONSTRAINT "earning_payout_id_payout_id_fk" FOREIGN KEY ("payout_id") REFERENCES "public"."payout"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout" ADD CONSTRAINT "payout_driver_id_driver_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."driver"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout" ADD CONSTRAINT "payout_trip_id_trip_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trip"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_origin_id_origin_id_fk" FOREIGN KEY ("origin_id") REFERENCES "public"."origin"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_destination_id_destination_id_fk" FOREIGN KEY ("destination_id") REFERENCES "public"."destination"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_trip_id_trip_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trip"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip" ADD CONSTRAINT "trip_origin_id_origin_id_fk" FOREIGN KEY ("origin_id") REFERENCES "public"."origin"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip" ADD CONSTRAINT "trip_destination_id_destination_id_fk" FOREIGN KEY ("destination_id") REFERENCES "public"."destination"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip" ADD CONSTRAINT "trip_driver_id_driver_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."driver"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_providers_provider_provider_id_unique_idx" ON "user_providers" USING btree ("provider","provider_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_providers_user_id_provider_unique_idx" ON "user_providers" USING btree ("user_id","provider");--> statement-breakpoint
CREATE UNIQUE INDEX "driver_dispatch_attempt_client_request_unique_idx" ON "driver_dispatch_attempt" USING btree ("client_request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "driver_dispatch_attempt_active_dispatch_unique_idx" ON "driver_dispatch_attempt" USING btree ("dispatch_id") WHERE status IN ('dialing', 'awaiting_dtmf');--> statement-breakpoint
CREATE UNIQUE INDEX "driver_dispatch_attempt_active_driver_unique_idx" ON "driver_dispatch_attempt" USING btree ("driver_id") WHERE status IN ('dialing', 'awaiting_dtmf');--> statement-breakpoint
CREATE UNIQUE INDEX "trip_dispatch_trip_id_unique_idx" ON "trip_dispatch" USING btree ("trip_id");--> statement-breakpoint
CREATE INDEX "trip_dispatch_status_deadline_idx" ON "trip_dispatch" USING btree ("status","deadline_at");--> statement-breakpoint
CREATE INDEX "passenger_booking_idx" ON "passenger" USING btree ("booking_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_booking_id_unique_idx" ON "payment" USING btree ("booking_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_refund_id_unique_idx" ON "payment" USING btree ("refund_id");--> statement-breakpoint
CREATE INDEX "refund_payment_id_idx" ON "refund" USING btree ("payment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "refund_payment_pending_unique_idx" ON "refund" USING btree ("payment_id") WHERE status = 'pending';--> statement-breakpoint
CREATE UNIQUE INDEX "earning_trip_unique_idx" ON "earning" USING btree ("trip_id");--> statement-breakpoint
CREATE UNIQUE INDEX "booking_origin_destination_date_user_departure_idx" ON "booking" USING btree ("origin_id","destination_id","trip_date","user_id","departure_time");--> statement-breakpoint
CREATE UNIQUE INDEX "destination_title_locality_unique_idx" ON "destination" USING btree ("title","locality");--> statement-breakpoint
CREATE UNIQUE INDEX "origin_title_locality_unique_idx" ON "origin" USING btree ("title","locality");--> statement-breakpoint
CREATE UNIQUE INDEX "trip_origin_destination_driver_date_departure_unique_idx" ON "trip" USING btree ("origin_id","destination_id","driver_id","date","departure_time");