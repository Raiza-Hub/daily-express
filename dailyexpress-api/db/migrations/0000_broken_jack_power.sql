CREATE TYPE "public"."bank_verification_status" AS ENUM('pending', 'active', 'failed');--> statement-breakpoint
CREATE TYPE "public"."kyc_status" AS ENUM('none', 'pending', 'active', 'failed');--> statement-breakpoint
CREATE TYPE "public"."notification_kind" AS ENUM('event', 'state');--> statement-breakpoint
CREATE TYPE "public"."notification_tone" AS ENUM('critical', 'attention', 'positive', 'info');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('initialized', 'pending', 'processing', 'successful', 'failed', 'cancelled', 'expired', 'refund_pending', 'refunded', 'refund_failed');--> statement-breakpoint
CREATE TYPE "public"."refund_status" AS ENUM('pending', 'successful', 'failed');--> statement-breakpoint
CREATE TYPE "public"."earning_status" AS ENUM('pending_trip_completion', 'available', 'processing', 'paid', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."payout_provider" AS ENUM('kora');--> statement-breakpoint
CREATE TYPE "public"."payout_status" AS ENUM('pending', 'processing', 'success', 'failed');--> statement-breakpoint
CREATE TYPE "public"."status" AS ENUM('inactive', 'pending', 'active');--> statement-breakpoint
CREATE TYPE "public"."trip_status" AS ENUM('pending', 'confirmed', 'cancelled', 'completed', 'awaiting_driver');--> statement-breakpoint
CREATE TYPE "public"."vehicle_type" AS ENUM('car', 'bus');--> statement-breakpoint
CREATE TABLE "admin_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"action" text NOT NULL,
	"admin_email" text NOT NULL,
	"target" text,
	"details" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "otp" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"otp" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "otp_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "password_reset_tokens_token_hash_unique" UNIQUE("token_hash")
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
	"password" text,
	"date_of_birth" timestamp NOT NULL,
	"email_verified" boolean NOT NULL,
	"referral" text,
	"profile_picture_url" text,
	"session_invalid_before" timestamp,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
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
	"bank_name" text NOT NULL,
	"bank_code" text NOT NULL,
	"account_number" text NOT NULL,
	"account_name" text NOT NULL,
	"bank_verification_status" "bank_verification_status" DEFAULT 'pending' NOT NULL,
	"bank_verification_failure_reason" text,
	"bank_verification_requested_at" timestamp,
	"bank_verified_at" timestamp,
	"kyc_status" "kyc_status" DEFAULT 'none' NOT NULL,
	"kyc_type" text,
	"kyc_id" text,
	"kyc_verification_reference" text,
	"kyc_failure_reason" text,
	"kyc_requested_at" timestamp,
	"kyc_verified_at" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "driver_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "driver_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "driver_stats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"driver_id" uuid NOT NULL,
	"total_earnings" bigint DEFAULT 0 NOT NULL,
	"pending_payments" bigint DEFAULT 0 NOT NULL,
	"total_passengers" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "driver_stats_driver_id_unique" UNIQUE("driver_id")
);
--> statement-breakpoint
CREATE TABLE "notification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"driver_id" uuid NOT NULL,
	"notification_key" varchar(191) NOT NULL,
	"kind" "notification_kind" DEFAULT 'event' NOT NULL,
	"type" varchar(96) NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"href" text,
	"tag" varchar(64) NOT NULL,
	"tone" "notification_tone" DEFAULT 'info' NOT NULL,
	"metadata" jsonb,
	"content_hash" varchar(128) NOT NULL,
	"read_at" timestamp,
	"occurred_at" timestamp DEFAULT now() NOT NULL,
	"archived_at" timestamp,
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
	"status" "payment_status" DEFAULT 'pending' NOT NULL,
	"payer_bank_name" text,
	"payer_account_number" varchar(32),
	"payer_account_name" text,
	"checkout_url" text,
	"failed_at" timestamp,
	"failure_code" text,
	"failure_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "payment_reference_unique" UNIQUE("reference")
);
--> statement-breakpoint
CREATE TABLE "refund" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid NOT NULL,
	"booking_id" uuid,
	"reference" varchar(128) NOT NULL,
	"amount" bigint NOT NULL,
	"currency" varchar(8) DEFAULT 'NGN' NOT NULL,
	"reason" text,
	"status" "refund_status" DEFAULT 'pending' NOT NULL,
	"failure_reason" text,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "refund_reference_unique" UNIQUE("reference")
);
--> statement-breakpoint
CREATE TABLE "earning" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"driver_id" uuid NOT NULL,
	"booking_id" uuid NOT NULL,
	"trip_id" uuid NOT NULL,
	"amount" bigint NOT NULL,
	"currency" varchar(8) DEFAULT 'NGN' NOT NULL,
	"status" "earning_status" DEFAULT 'pending_trip_completion' NOT NULL,
	"payout_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "earning_booking_id_unique" UNIQUE("booking_id")
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
	"status" "payout_status" DEFAULT 'processing' NOT NULL,
	"driver_email" varchar(255),
	"failure_code" text,
	"failure_reason" text,
	"failed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "payout_reference_unique" UNIQUE("reference")
);
--> statement-breakpoint
CREATE TABLE "booking" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"route_id" uuid NOT NULL,
	"trip_date" timestamp NOT NULL,
	"vehicle_type" "vehicle_type" NOT NULL,
	"trip_id" uuid,
	"user_id" uuid NOT NULL,
	"seat_number" integer,
	"first_name" text,
	"last_name" text,
	"fare_amount" bigint DEFAULT 0 NOT NULL,
	"fee_amount" bigint DEFAULT 0 NOT NULL,
	"currency" varchar(8) DEFAULT 'NGN' NOT NULL,
	"status" "trip_status" DEFAULT 'pending' NOT NULL,
	"payment_reference" varchar(128),
	"payment_status" varchar(32) DEFAULT 'initialized' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "external_driver" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"country" text,
	"state" text,
	"vehicle_make" text,
	"vehicle_model" text,
	"vehicle_plate_number" text,
	"vehicle_color" text,
	"vehicle_capacity" integer,
	"assigned_by" text NOT NULL,
	"assigned_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "external_driver_trip_id_unique" UNIQUE("trip_id")
);
--> statement-breakpoint
CREATE TABLE "route" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pickup_location_title" text NOT NULL,
	"pickup_location_locality" text NOT NULL,
	"pickup_location_label" text NOT NULL,
	"dropoff_location_title" text NOT NULL,
	"dropoff_location_locality" text NOT NULL,
	"dropoff_location_label" text NOT NULL,
	"intermediate_stops_title" text,
	"intermediate_stops_locality" text,
	"intermediate_stops_label" text,
	"meeting_point" text NOT NULL,
	"price_car" bigint NOT NULL,
	"price_bus" bigint NOT NULL,
	"departure_time" time NOT NULL,
	"arrival_time" time NOT NULL,
	"status" "status" DEFAULT 'active' NOT NULL,
	"zone_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trip" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"route_id" uuid NOT NULL,
	"driver_id" uuid,
	"date" timestamp NOT NULL,
	"vehicle_type" "vehicle_type" NOT NULL,
	"capacity" integer NOT NULL,
	"booked_seats" integer DEFAULT 0 NOT NULL,
	"status" "trip_status" DEFAULT 'awaiting_driver' NOT NULL,
	"driver_claimed_at" timestamp,
	"vehicle_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "trip_booked_seats_check" CHECK ("trip"."booked_seats" <= "trip"."capacity")
);
--> statement-breakpoint
CREATE TABLE "vehicle" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"driver_id" uuid NOT NULL,
	"plate_number" text NOT NULL,
	"make" text NOT NULL,
	"model" text NOT NULL,
	"capacity" integer NOT NULL,
	"color" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zone" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"fee" bigint NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "zone_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_providers" ADD CONSTRAINT "user_providers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver" ADD CONSTRAINT "driver_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_stats" ADD CONSTRAINT "driver_stats_driver_id_driver_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."driver"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_driver_id_driver_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."driver"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_booking_id_booking_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."booking"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund" ADD CONSTRAINT "refund_payment_id_payment_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payment"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund" ADD CONSTRAINT "refund_booking_id_booking_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."booking"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "earning" ADD CONSTRAINT "earning_driver_id_driver_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."driver"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "earning" ADD CONSTRAINT "earning_booking_id_booking_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."booking"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "earning" ADD CONSTRAINT "earning_trip_id_trip_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trip"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_route_id_route_id_fk" FOREIGN KEY ("route_id") REFERENCES "public"."route"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_trip_id_trip_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trip"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_driver" ADD CONSTRAINT "external_driver_trip_id_trip_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trip"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route" ADD CONSTRAINT "route_zone_id_zone_id_fk" FOREIGN KEY ("zone_id") REFERENCES "public"."zone"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip" ADD CONSTRAINT "trip_route_id_route_id_fk" FOREIGN KEY ("route_id") REFERENCES "public"."route"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip" ADD CONSTRAINT "trip_driver_id_driver_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."driver"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip" ADD CONSTRAINT "trip_vehicle_id_vehicle_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicle"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle" ADD CONSTRAINT "vehicle_driver_id_driver_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."driver"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_providers_provider_provider_id_unique_idx" ON "user_providers" USING btree ("provider","provider_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_providers_user_id_provider_unique_idx" ON "user_providers" USING btree ("user_id","provider");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_driver_key_unique" ON "notification" USING btree ("driver_id","notification_key");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_booking_id_unique_idx" ON "payment" USING btree ("booking_id");--> statement-breakpoint
CREATE UNIQUE INDEX "booking_route_user_vt_active_idx" ON "booking" USING btree ("route_id","trip_date","user_id","vehicle_type") WHERE "booking"."status" in ('pending', 'confirmed');--> statement-breakpoint
CREATE UNIQUE INDEX "booking_trip_id_seat_number_active_idx" ON "booking" USING btree ("trip_id","seat_number") WHERE "booking"."seat_number" is not null and "booking"."status" in ('pending', 'confirmed');--> statement-breakpoint
CREATE UNIQUE INDEX "route_origin_destination_departure_unique_idx" ON "route" USING btree ("pickup_location_title","pickup_location_locality","pickup_location_label","dropoff_location_title","dropoff_location_locality","dropoff_location_label","departure_time");--> statement-breakpoint
