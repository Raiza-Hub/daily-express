UPDATE "payment"
SET "status" = 'pending',
    "updated_at" = now()
WHERE "status" = 'initialized';
--> statement-breakpoint
ALTER TABLE "payment"
  ALTER COLUMN "status" SET DEFAULT 'pending';
