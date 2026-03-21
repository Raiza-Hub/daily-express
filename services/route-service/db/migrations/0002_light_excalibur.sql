CREATE TYPE "public"."status" AS ENUM('inactive', 'pending', 'active');--> statement-breakpoint
CREATE TYPE "public"."trip_type" AS ENUM('one_way', 'round_trip');--> statement-breakpoint
CREATE TYPE "public"."vehicle_type" AS ENUM('car', 'bus', 'coaster');--> statement-breakpoint
ALTER TABLE "route" DROP CONSTRAINT "route_driver_id_unique";