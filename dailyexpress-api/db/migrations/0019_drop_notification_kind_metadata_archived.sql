ALTER TABLE "notification" DROP COLUMN "archived_at";--> statement-breakpoint
ALTER TABLE "notification" DROP COLUMN "kind";--> statement-breakpoint
ALTER TABLE "notification" DROP COLUMN "metadata";--> statement-breakpoint
DROP TYPE "notification_kind";--> statement-breakpoint