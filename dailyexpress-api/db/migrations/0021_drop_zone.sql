ALTER TABLE "route" DROP CONSTRAINT "route_zone_id_zone_id_fk";
--> statement-breakpoint
ALTER TABLE "route" DROP COLUMN "zone_id";
--> statement-breakpoint
DROP TABLE "zone";