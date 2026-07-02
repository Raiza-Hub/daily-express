ALTER TABLE "route" ALTER COLUMN "departure_time" TYPE time USING "departure_time"::time;
ALTER TABLE "route" ALTER COLUMN "arrival_time" TYPE time USING "arrival_time"::time;
