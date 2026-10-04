-- modify "live_sessions" table
ALTER TABLE "live_sessions" ADD COLUMN "moderation_visibility" character varying NOT NULL DEFAULT 'visible';
