-- reverse: create "live_host_defaults" table
DROP TABLE "live_host_defaults";
-- reverse: modify "live_room_settings" table
ALTER TABLE "live_room_settings" DROP COLUMN "comment_audience";
-- reverse: create index "livesession_state_scheduled_at" to table: "live_sessions"
DROP INDEX "livesession_state_scheduled_at";
-- reverse: modify "live_sessions" table
ALTER TABLE "live_sessions" DROP COLUMN "reminder_sent_at", DROP COLUMN "scheduled_at";
