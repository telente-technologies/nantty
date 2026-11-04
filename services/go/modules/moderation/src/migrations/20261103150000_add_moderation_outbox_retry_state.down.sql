ALTER TABLE "outbox_events"
  DROP COLUMN "dead_lettered_at",
  DROP COLUMN "last_error",
  DROP COLUMN "next_attempt_at",
  DROP COLUMN "attempt_count";
