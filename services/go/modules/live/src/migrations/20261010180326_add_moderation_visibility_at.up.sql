-- modify "live_sessions" table
ALTER TABLE "live_sessions" ADD COLUMN "moderation_visibility_at" timestamptz NULL;
