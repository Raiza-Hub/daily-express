ALTER TABLE "payout" ADD COLUMN "recipient_bank_name" text;
ALTER TABLE "payout" ADD COLUMN "recipient_account_last4" varchar(4);

UPDATE "payout" SET
  "recipient_bank_name" = pr."bank_name",
  "recipient_account_last4" = pr."account_number_last4"
FROM "payout_recipient" pr
WHERE "payout"."recipient_id" = pr."id";

ALTER TABLE "payout" DROP COLUMN "recipient_id";
DROP TABLE "payout_recipient";
DROP TYPE "payout_recipient_status";
