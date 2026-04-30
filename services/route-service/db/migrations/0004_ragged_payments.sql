ALTER TABLE "booking" ADD COLUMN "payment_reference" varchar(128);--> statement-breakpoint
ALTER TABLE "booking" ADD COLUMN "payment_status" varchar(32) DEFAULT 'initialized' NOT NULL;
