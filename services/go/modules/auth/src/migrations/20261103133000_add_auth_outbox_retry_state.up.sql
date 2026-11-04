ALTER TABLE "outbox_events"
  ADD COLUMN "attempt_count" bigint NOT NULL DEFAULT 0,
  ADD COLUMN "next_attempt_at" timestamptz NULL,
  ADD COLUMN "last_error" character varying(1000) NOT NULL DEFAULT '',
  ADD COLUMN "dead_lettered_at" timestamptz NULL;
