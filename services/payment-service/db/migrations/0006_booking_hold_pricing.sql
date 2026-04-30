ALTER TABLE "booking_hold"
	ADD COLUMN IF NOT EXISTS "fare_amount" integer NOT NULL,
	ADD COLUMN IF NOT EXISTS "currency" varchar(8) NOT NULL DEFAULT 'NGN';
