ALTER TABLE "payment" ADD COLUMN "payment_method" varchar(32);--> statement-breakpoint
ALTER TABLE "payment" ADD COLUMN "payer_bank_name" text;--> statement-breakpoint
ALTER TABLE "payment" ADD COLUMN "payer_account_number" varchar(32);--> statement-breakpoint
ALTER TABLE "payment" ADD COLUMN "payer_account_name" text;--> statement-breakpoint
ALTER TABLE "payout" DROP COLUMN "kora_fee_amount";--> statement-breakpoint
ALTER TABLE "payout_attempt" DROP COLUMN "kora_fee_amount";