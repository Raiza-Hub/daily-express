ALTER TABLE "booking_projection" RENAME TO "booking_hold";
--> statement-breakpoint
ALTER INDEX "booking_projection_booking_id_idx" RENAME TO "booking_hold_booking_id_idx";
--> statement-breakpoint
ALTER INDEX "booking_projection_expires_at_idx" RENAME TO "booking_hold_expires_at_idx";
