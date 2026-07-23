ALTER TABLE "payment" DROP COLUMN IF EXISTS "provider_transaction_id";
ALTER TABLE "payment" DROP COLUMN IF EXISTS "payment_method";
ALTER TABLE "payment" DROP COLUMN IF EXISTS "raw_verification_response";
ALTER TABLE "payment" DROP COLUMN IF EXISTS "metadata";
ALTER TABLE "payment_webhook" DROP COLUMN IF EXISTS "processed_at";
ALTER TABLE "admin_audit_log" DROP COLUMN IF EXISTS "ip";
