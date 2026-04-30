DROP INDEX IF EXISTS "notification_driver_occurred_at_idx";
DROP INDEX IF EXISTS "notification_driver_read_at_idx";

CREATE INDEX IF NOT EXISTS "notification_driver_active_cursor_idx"
  ON "notification" ("driver_id", "occurred_at" DESC, "created_at" DESC)
  WHERE "archived_at" IS NULL;

CREATE INDEX IF NOT EXISTS "notification_driver_unread_active_idx"
  ON "notification" ("driver_id", "occurred_at" DESC, "created_at" DESC)
  WHERE "archived_at" IS NULL AND "read_at" IS NULL;

CREATE INDEX IF NOT EXISTS "consumed_event_topic_processed_at_idx"
  ON "consumed_event" ("topic", "processed_at" DESC);
