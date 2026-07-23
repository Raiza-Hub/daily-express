ALTER TABLE "payment" DROP COLUMN IF EXISTS "provider_transaction_id";
ALTER TABLE "payment" DROP COLUMN IF EXISTS "payment_method";
ALTER TABLE "payment" DROP COLUMN IF EXISTS "raw_verification_response";
ALTER TABLE "payment" DROP COLUMN IF EXISTS "metadata";
