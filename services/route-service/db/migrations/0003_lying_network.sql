DROP TABLE "schedule" CASCADE;--> statement-breakpoint
ALTER TABLE "route" ADD COLUMN "departure_time" timestamp NOT NULL;--> statement-breakpoint
ALTER TABLE "route" ADD COLUMN "arrival_time" timestamp NOT NULL;--> statement-breakpoint
ALTER TABLE "route" ADD COLUMN "travel_duration" integer NOT NULL;