DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_enum enum_value
    JOIN pg_type enum_type ON enum_value.enumtypid = enum_type.oid
    WHERE enum_type.typname = 'payment_provider'
      AND enum_value.enumlabel = 'paystack'
  ) THEN
    ALTER TYPE "payment_provider" RENAME VALUE 'paystack' TO 'kora';
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'payment'
      AND column_name = 'amount_minor'
  ) THEN
    ALTER TABLE "payment" RENAME COLUMN "amount_minor" TO "amount";
  END IF;
END $$;
--> statement-breakpoint
UPDATE "payment"
SET "amount" = ROUND("amount" / 100.0);
--> statement-breakpoint
ALTER TABLE "payment" ALTER COLUMN "provider" SET DEFAULT 'kora';
--> statement-breakpoint
ALTER TABLE "payment_webhook" ALTER COLUMN "provider" SET DEFAULT 'kora';
--> statement-breakpoint
ALTER TABLE "payment_webhook" ALTER COLUMN "event_type" SET DEFAULT 'kora.event';
