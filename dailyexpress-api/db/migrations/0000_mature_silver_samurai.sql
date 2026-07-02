CREATE TYPE "public"."bank_verification_status" AS ENUM('pending', 'active', 'failed');--> statement-breakpoint
CREATE TYPE "public"."driver_profile_image_upload_status" AS ENUM('pending', 'processing', 'succeeded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."notification_kind" AS ENUM('event', 'state');--> statement-breakpoint
CREATE TYPE "public"."notification_tone" AS ENUM('critical', 'attention', 'positive', 'info');--> statement-breakpoint
CREATE TYPE "public"."payment_provider" AS ENUM('kora');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('initialized', 'pending', 'processing', 'successful', 'failed', 'cancelled', 'expired', 'refund_pending', 'refunded', 'refund_failed');--> statement-breakpoint
CREATE TYPE "public"."refund_status" AS ENUM('pending', 'successful', 'failed');--> statement-breakpoint
CREATE TYPE "public"."earning_status" AS ENUM('pending_trip_completion', 'available', 'processing', 'paid', 'cancelled', 'manual_review');--> statement-breakpoint
CREATE TYPE "public"."payout_provider" AS ENUM('kora');--> statement-breakpoint
CREATE TYPE "public"."payout_recipient_status" AS ENUM('active', 'stale', 'failed');--> statement-breakpoint
CREATE TYPE "public"."payout_status" AS ENUM('pending', 'processing', 'success', 'failed', 'permanent_failed');--> statement-breakpoint
CREATE TYPE "public"."status" AS ENUM('inactive', 'pending', 'active');--> statement-breakpoint
CREATE TYPE "public"."trip_status" AS ENUM('pending', 'confirmed', 'cancelled', 'completed', 'awaiting_driver');--> statement-breakpoint
CREATE TYPE "public"."vehicle_status" AS ENUM('available', 'in_use');--> statement-breakpoint
CREATE TYPE "public"."vehicle_type" AS ENUM('car', 'bus');--> statement-breakpoint
CREATE TABLE "admin_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"action" text NOT NULL,
	"admin_email" text NOT NULL,
	"target" text,
	"ip" text,
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
	"anonymized_at" timestamp,
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
	"is_active" boolean DEFAULT true NOT NULL,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "driver_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "driver_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "driver_profile_image_upload" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"driver_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"status" "driver_profile_image_upload_status" DEFAULT 'pending' NOT NULL,
	"file_name" text,
	"mime_type" varchar(128) NOT NULL,
	"size" integer NOT NULL,
	"file_base64" text NOT NULL,
	"old_profile_picture_url" text,
	"secure_url" text,
	"public_id" text,
	"error_message" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"processed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "driver_stats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"driver_id" uuid NOT NULL,
	"total_earnings" bigint DEFAULT 0 NOT NULL,
	"pending_payments" bigint DEFAULT 0 NOT NULL,
	"in_review_payments" bigint DEFAULT 0 NOT NULL,
	"total_passengers" integer DEFAULT 0 NOT NULL,
	"active_routes" integer DEFAULT 0 NOT NULL,
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
	"provider" "payment_provider" DEFAULT 'kora' NOT NULL,
	"reference" varchar(128) NOT NULL,
	"provider_transaction_id" varchar(128),
	"amount" bigint NOT NULL,
	"currency" varchar(8) DEFAULT 'NGN' NOT NULL,
	"product_name" text NOT NULL,
	"customer_name" text,
	"customer_email" text,
	"status" "payment_status" DEFAULT 'pending' NOT NULL,
	"provider_status" varchar(32),
	"checkout_url" text,
	"checkout_token" text,
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
	"provider" "payment_provider" DEFAULT 'kora' NOT NULL,
	"payment_reference" varchar(128),
	"event_type" varchar(64) DEFAULT 'kora.event',
	"signature_valid" boolean DEFAULT false NOT NULL,
	"payload" jsonb NOT NULL,
	"verification_note" text,
	"processed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refund" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid NOT NULL,
	"booking_id" uuid,
	"reference" varchar(128) NOT NULL,
	"provider_refund_reference" varchar(128),
	"amount" bigint NOT NULL,
	"currency" varchar(8) DEFAULT 'NGN' NOT NULL,
	"reason" text,
	"status" "refund_status" DEFAULT 'pending' NOT NULL,
	"provider_status" varchar(32),
	"raw_provider_response" jsonb,
	"failure_reason" text,
	"initiated_by" varchar(32) DEFAULT 'auto' NOT NULL,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "refund_reference_unique" UNIQUE("reference")
);
--> statement-breakpoint
CREATE TABLE "webhook_processed" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_type" varchar(64) NOT NULL,
	"event_reference" varchar(128) NOT NULL,
	"processed_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "webhook_processed_event_reference_unique" UNIQUE("event_reference")
);
--> statement-breakpoint
CREATE TABLE "earning" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"driver_id" uuid NOT NULL,
	"booking_id" uuid NOT NULL,
	"trip_id" uuid NOT NULL,
	"route_id" uuid NOT NULL,
	"trip_date" timestamp NOT NULL,
	"pickup_title" text NOT NULL,
	"dropoff_title" text NOT NULL,
	"gross_amount_minor" bigint NOT NULL,
	"fee_amount_minor" bigint NOT NULL,
	"net_amount_minor" bigint NOT NULL,
	"currency" varchar(8) DEFAULT 'NGN' NOT NULL,
	"status" "earning_status" DEFAULT 'pending_trip_completion' NOT NULL,
	"source_event_id" varchar(128) NOT NULL,
	"payout_id" uuid,
	"available_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "earning_booking_id_unique" UNIQUE("booking_id"),
	CONSTRAINT "earning_source_event_id_unique" UNIQUE("source_event_id")
);
--> statement-breakpoint
CREATE TABLE "payout" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"driver_id" uuid NOT NULL,
	"earning_id" uuid NOT NULL,
	"recipient_id" uuid NOT NULL,
	"reference" varchar(128) NOT NULL,
	"provider" "payout_provider" DEFAULT 'kora' NOT NULL,
	"provider_transfer_code" varchar(128),
	"provider_transfer_id" varchar(128),
	"amount_minor" bigint NOT NULL,
	"kora_fee_amount" bigint,
	"currency" varchar(8) DEFAULT 'NGN' NOT NULL,
	"earnings_count" integer NOT NULL,
	"status" "payout_status" DEFAULT 'processing' NOT NULL,
	"driver_email" varchar(255),
	"failure_code" text,
	"failure_reason" text,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"next_retry_at" timestamp,
	"initiated_at" timestamp,
	"settled_at" timestamp,
	"failed_at" timestamp,
	"raw_initiate_response" jsonb,
	"raw_final_status_response" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "payout_reference_unique" UNIQUE("reference")
);
--> statement-breakpoint
CREATE TABLE "payout_attempt" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payout_id" uuid NOT NULL,
	"attempt_number" integer NOT NULL,
	"kora_reference" varchar(128) NOT NULL,
	"status" varchar(32) DEFAULT 'pending' NOT NULL,
	"failure_reason" text,
	"kora_fee_amount" bigint,
	"initiated_at" timestamp DEFAULT now() NOT NULL,
	"settled_at" timestamp,
	"raw_webhook" jsonb,
	CONSTRAINT "payout_attempt_kora_reference_unique" UNIQUE("kora_reference")
);
--> statement-breakpoint
CREATE TABLE "payout_recipient" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"driver_id" uuid NOT NULL,
	"provider" "payout_provider" DEFAULT 'kora' NOT NULL,
	"recipient_code" varchar(128) NOT NULL,
	"provider_recipient_id" varchar(128),
	"bank_code" varchar(32) NOT NULL,
	"bank_name" text NOT NULL,
	"account_name" text NOT NULL,
	"account_number_last4" varchar(4) NOT NULL,
	"details_fingerprint" varchar(128) NOT NULL,
	"status" "payout_recipient_status" DEFAULT 'active' NOT NULL,
	"raw_response" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "payout_recipient_driver_id_unique" UNIQUE("driver_id")
);
--> statement-breakpoint
CREATE TABLE "payout_webhook" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_type" varchar(64) NOT NULL,
	"reference" varchar(128),
	"signature_valid" boolean DEFAULT false NOT NULL,
	"payload" jsonb NOT NULL,
	"processed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
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
	"currency" varchar(8) DEFAULT 'NGN' NOT NULL,
	"status" "trip_status" DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp,
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
	"departure_time" timestamp NOT NULL,
	"arrival_time" timestamp NOT NULL,
	"status" "status" DEFAULT 'active' NOT NULL,
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
	"status" "vehicle_status" DEFAULT 'available' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_providers" ADD CONSTRAINT "user_providers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_profile_image_upload" ADD CONSTRAINT "driver_profile_image_upload_driver_id_driver_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."driver"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_stats" ADD CONSTRAINT "driver_stats_driver_id_driver_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."driver"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_driver_id_driver_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."driver"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_booking_id_booking_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."booking"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund" ADD CONSTRAINT "refund_payment_id_payment_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payment"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund" ADD CONSTRAINT "refund_booking_id_booking_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."booking"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "earning" ADD CONSTRAINT "earning_driver_id_driver_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."driver"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "earning" ADD CONSTRAINT "earning_booking_id_booking_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."booking"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "earning" ADD CONSTRAINT "earning_trip_id_trip_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trip"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "earning" ADD CONSTRAINT "earning_route_id_route_id_fk" FOREIGN KEY ("route_id") REFERENCES "public"."route"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout" ADD CONSTRAINT "payout_driver_id_driver_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."driver"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout" ADD CONSTRAINT "payout_earning_id_earning_id_fk" FOREIGN KEY ("earning_id") REFERENCES "public"."earning"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout" ADD CONSTRAINT "payout_recipient_id_payout_recipient_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."payout_recipient"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout_attempt" ADD CONSTRAINT "payout_attempt_payout_id_payout_id_fk" FOREIGN KEY ("payout_id") REFERENCES "public"."payout"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout_recipient" ADD CONSTRAINT "payout_recipient_driver_id_driver_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."driver"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_route_id_route_id_fk" FOREIGN KEY ("route_id") REFERENCES "public"."route"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_trip_id_trip_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trip"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_driver" ADD CONSTRAINT "external_driver_trip_id_trip_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trip"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip" ADD CONSTRAINT "trip_route_id_route_id_fk" FOREIGN KEY ("route_id") REFERENCES "public"."route"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip" ADD CONSTRAINT "trip_driver_id_driver_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."driver"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip" ADD CONSTRAINT "trip_vehicle_id_vehicle_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicle"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle" ADD CONSTRAINT "vehicle_driver_id_driver_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."driver"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_audit_log_created_at_idx" ON "admin_audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "admin_audit_log_admin_email_idx" ON "admin_audit_log" USING btree ("admin_email");--> statement-breakpoint
CREATE INDEX "password_reset_tokens_user_id_idx" ON "password_reset_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "password_reset_tokens_expires_at_idx" ON "password_reset_tokens" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "user_providers_provider_provider_id_unique_idx" ON "user_providers" USING btree ("provider","provider_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_providers_user_id_provider_unique_idx" ON "user_providers" USING btree ("user_id","provider");--> statement-breakpoint
CREATE INDEX "driver_profile_image_upload_driver_id_idx" ON "driver_profile_image_upload" USING btree ("driver_id");--> statement-breakpoint
CREATE INDEX "driver_profile_image_upload_status_idx" ON "driver_profile_image_upload" USING btree ("status");--> statement-breakpoint
CREATE INDEX "driver_profile_image_upload_user_id_idx" ON "driver_profile_image_upload" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_driver_key_unique" ON "notification" USING btree ("driver_id","notification_key");--> statement-breakpoint
CREATE INDEX "notification_driver_active_cursor_idx" ON "notification" USING btree ("driver_id","occurred_at" DESC NULLS LAST,"created_at" DESC NULLS LAST) WHERE "notification"."archived_at" is null;--> statement-breakpoint
CREATE INDEX "notification_driver_unread_active_idx" ON "notification" USING btree ("driver_id","occurred_at" DESC NULLS LAST,"created_at" DESC NULLS LAST) WHERE ("notification"."archived_at" is null and "notification"."read_at" is null);--> statement-breakpoint
CREATE INDEX "payment_user_id_idx" ON "payment" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "payment_status_idx" ON "payment" USING btree ("status");--> statement-breakpoint
CREATE INDEX "payment_created_at_idx" ON "payment" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "payment_status_created_idx" ON "payment" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_booking_id_unique_idx" ON "payment" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "payment_webhook_payment_reference_idx" ON "payment_webhook" USING btree ("payment_reference");--> statement-breakpoint
CREATE INDEX "payment_webhook_created_at_idx" ON "payment_webhook" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "refund_payment_id_idx" ON "refund" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "refund_booking_id_idx" ON "refund" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "refund_status_idx" ON "refund" USING btree ("status");--> statement-breakpoint
CREATE INDEX "refund_provider_ref_idx" ON "refund" USING btree ("provider_refund_reference");--> statement-breakpoint
CREATE INDEX "earning_driver_id_idx" ON "earning" USING btree ("driver_id");--> statement-breakpoint
CREATE INDEX "earning_trip_id_idx" ON "earning" USING btree ("trip_id");--> statement-breakpoint
CREATE INDEX "earning_route_id_idx" ON "earning" USING btree ("route_id");--> statement-breakpoint
CREATE INDEX "earning_status_idx" ON "earning" USING btree ("status");--> statement-breakpoint
CREATE INDEX "earning_driver_status_idx" ON "earning" USING btree ("driver_id","status");--> statement-breakpoint
CREATE INDEX "earning_trip_status_idx" ON "earning" USING btree ("trip_id","status");--> statement-breakpoint
CREATE INDEX "payout_driver_id_idx" ON "payout" USING btree ("driver_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payout_earning_id_unique_idx" ON "payout" USING btree ("earning_id");--> statement-breakpoint
CREATE INDEX "payout_status_idx" ON "payout" USING btree ("status");--> statement-breakpoint
CREATE INDEX "payout_driver_created_at_idx" ON "payout" USING btree ("driver_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "payout_driver_status_created_at_idx" ON "payout" USING btree ("driver_id","status","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "payout_driver_status_settled_at_idx" ON "payout" USING btree ("driver_id","status","settled_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "payout_status_retry_idx" ON "payout" USING btree ("status","next_retry_at");--> statement-breakpoint
CREATE INDEX "payout_attempt_payout_id_idx" ON "payout_attempt" USING btree ("payout_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payout_attempt_number_unique_idx" ON "payout_attempt" USING btree ("payout_id","attempt_number");--> statement-breakpoint
CREATE INDEX "payout_webhook_reference_idx" ON "payout_webhook" USING btree ("reference");--> statement-breakpoint
CREATE INDEX "payout_webhook_created_at_idx" ON "payout_webhook" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "booking_trip_id_idx" ON "booking" USING btree ("trip_id");--> statement-breakpoint
CREATE INDEX "booking_user_id_idx" ON "booking" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "booking_route_date_vt_idx" ON "booking" USING btree ("route_id","trip_date","vehicle_type");--> statement-breakpoint
CREATE INDEX "booking_payment_reference_idx" ON "booking" USING btree ("payment_reference");--> statement-breakpoint
CREATE INDEX "booking_expires_at_idx" ON "booking" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "booking_user_visible_created_at_idx" ON "booking" USING btree ("user_id","created_at" DESC NULLS LAST) WHERE "booking"."status" in ('confirmed', 'completed') and "booking"."payment_status" not in ('failed', 'cancelled', 'expired');--> statement-breakpoint
CREATE UNIQUE INDEX "booking_route_user_vt_active_idx" ON "booking" USING btree ("route_id","trip_date","user_id","vehicle_type") WHERE "booking"."status" in ('pending', 'confirmed');--> statement-breakpoint
CREATE UNIQUE INDEX "booking_trip_id_seat_number_active_idx" ON "booking" USING btree ("trip_id","seat_number") WHERE "booking"."seat_number" is not null and "booking"."status" in ('pending', 'confirmed');--> statement-breakpoint
CREATE UNIQUE INDEX "route_origin_destination_departure_unique_idx" ON "route" USING btree ("pickup_location_title","pickup_location_locality","pickup_location_label","dropoff_location_title","dropoff_location_locality","dropoff_location_label","departure_time");--> statement-breakpoint
CREATE INDEX "route_created_at_idx" ON "route" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "pickup_location_title_trgm_idx" ON "route" USING gin ("pickup_location_title" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "pickup_location_locality_trgm_idx" ON "route" USING gin ("pickup_location_locality" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "pickup_location_label_trgm_idx" ON "route" USING gin ("pickup_location_label" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "dropoff_location_title_trgm_idx" ON "route" USING gin ("dropoff_location_title" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "dropoff_location_locality_trgm_idx" ON "route" USING gin ("dropoff_location_locality" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "dropoff_location_label_trgm_idx" ON "route" USING gin ("dropoff_location_label" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "trip_driver_date_idx" ON "trip" USING btree ("driver_id","date");--> statement-breakpoint
CREATE INDEX "trip_route_date_vt_idx" ON "trip" USING btree ("route_id","date","vehicle_type");--> statement-breakpoint
CREATE INDEX "vehicle_driver_id_idx" ON "vehicle" USING btree ("driver_id");