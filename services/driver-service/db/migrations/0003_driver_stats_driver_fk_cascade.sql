DELETE FROM "driver_stats"
WHERE NOT EXISTS (
  SELECT 1
  FROM "driver"
  WHERE "driver"."id" = "driver_stats"."driver_id"
);

ALTER TABLE "driver_stats"
ADD CONSTRAINT "driver_stats_driver_id_driver_id_fk"
FOREIGN KEY ("driver_id") REFERENCES "public"."driver"("id") ON DELETE CASCADE;
