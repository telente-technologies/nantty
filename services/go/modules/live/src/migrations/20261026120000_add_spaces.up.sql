CREATE TABLE "spaces" (
  "id" uuid NOT NULL,
  "created_at" timestamptz NOT NULL,
  "host_id" uuid NOT NULL,
  "title" character varying(140) NOT NULL,
  "description" character varying(2000) NOT NULL DEFAULT '',
  "state" character varying NOT NULL DEFAULT 'scheduled',
  "visibility" character varying NOT NULL DEFAULT 'public',
  "scheduled_at" timestamptz NULL,
  "started_at" timestamptz NULL,
  "ended_at" timestamptz NULL,
  "livekit_room" character varying NOT NULL,
  "listeners" bigint NOT NULL DEFAULT 0,
  "peak_listeners" bigint NOT NULL DEFAULT 0,
  "moderation_visibility" character varying NOT NULL DEFAULT 'visible',
  "updated_at" timestamptz NOT NULL,
  "gifts_enabled" boolean NOT NULL DEFAULT false,
  "video_enabled" boolean NOT NULL DEFAULT false,
  "metadata" jsonb NULL,
  PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "spaces_livekit_room" ON "spaces" ("livekit_room");
CREATE INDEX "space_state_scheduled_at" ON "spaces" ("state", "scheduled_at");
CREATE INDEX "space_host_id_state" ON "spaces" ("host_id", "state");
