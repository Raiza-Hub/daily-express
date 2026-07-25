DROP INDEX IF EXISTS booking_expires_at_idx;
ALTER TABLE booking DROP COLUMN IF EXISTS expires_at;
