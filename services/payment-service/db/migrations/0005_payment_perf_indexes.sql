CREATE INDEX IF NOT EXISTS "outbox_aggregate_event_idx"
  ON "outbox_events" ("aggregate_id", "event_type");
