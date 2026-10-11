-- modify "live_sessions" table
ALTER TABLE "live_sessions" ADD COLUMN "scheduled_at" timestamptz NULL, ADD COLUMN "reminder_sent_at" timestamptz NULL;
-- create index "livesession_state_scheduled_at" to table: "live_sessions"
CREATE INDEX "livesession_state_scheduled_at" ON "live_sessions" ("state", "scheduled_at");
-- modify "live_room_settings" table
ALTER TABLE "live_room_settings" ADD COLUMN "comment_audience" character varying NOT NULL DEFAULT 'everyone';
-- create "live_host_defaults" table
CREATE TABLE "live_host_defaults" ("id" uuid NOT NULL, "comments_enabled" boolean NOT NULL DEFAULT true, "comment_audience" character varying NOT NULL DEFAULT 'everyone', "slow_mode_seconds" bigint NOT NULL DEFAULT 0, "blocked_words" jsonb NULL, "moderator_ids" jsonb NULL, "updated_at" timestamptz NOT NULL, PRIMARY KEY ("id"));
