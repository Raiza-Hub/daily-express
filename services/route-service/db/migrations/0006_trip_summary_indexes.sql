CREATE INDEX "trip_driver_date_idx" ON "trip" USING btree ("driver_id","date");--> statement-breakpoint
CREATE INDEX "trip_route_date_idx" ON "trip" USING btree ("route_id","date");
