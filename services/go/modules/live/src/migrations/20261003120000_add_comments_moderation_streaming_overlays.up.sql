-- create "live_comments" table
CREATE TABLE "live_comments" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "live_id" uuid NOT NULL, "author_id" uuid NOT NULL, "body" character varying NOT NULL, "mentions" jsonb NULL, "reply_to_id" uuid NULL, "deleted_at" timestamptz NULL, "deleted_by" uuid NULL, PRIMARY KEY ("id"));
-- create index "livecomment_live_id_author_id_id" to table: "live_comments"
CREATE INDEX "livecomment_live_id_author_id_id" ON "live_comments" ("live_id", "author_id", "id");
-- create index "livecomment_live_id_id" to table: "live_comments"
CREATE INDEX "livecomment_live_id_id" ON "live_comments" ("live_id", "id");
-- create "live_room_settings" table
CREATE TABLE "live_room_settings" ("id" uuid NOT NULL, "comments_enabled" boolean NOT NULL DEFAULT true, "slow_mode_seconds" bigint NOT NULL DEFAULT 0, "blocked_words" jsonb NULL, "pinned_comment_id" uuid NULL, "record_enabled" boolean NOT NULL DEFAULT false, PRIMARY KEY ("id"));
-- create "live_moderators" table
CREATE TABLE "live_moderators" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "live_id" uuid NOT NULL, "user_id" uuid NOT NULL, "granted_by" uuid NOT NULL, PRIMARY KEY ("id"));
-- create index "livemoderator_live_id_user_id" to table: "live_moderators"
CREATE UNIQUE INDEX "livemoderator_live_id_user_id" ON "live_moderators" ("live_id", "user_id");
-- create "live_restrictions" table
CREATE TABLE "live_restrictions" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "live_id" uuid NOT NULL, "user_id" uuid NOT NULL, "kind" character varying NOT NULL, "imposed_by" uuid NOT NULL, "reason" character varying NULL, "expires_at" timestamptz NULL, PRIMARY KEY ("id"));
-- create index "liverestriction_live_id_user_id_kind" to table: "live_restrictions"
CREATE UNIQUE INDEX "liverestriction_live_id_user_id_kind" ON "live_restrictions" ("live_id", "user_id", "kind");
-- create "live_ingresses" table
CREATE TABLE "live_ingresses" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "live_id" uuid NOT NULL, "livekit_ingress_id" character varying NOT NULL, "protocol" character varying NOT NULL, "stream_key_hint" character varying NOT NULL, "state" character varying NOT NULL DEFAULT 'active', "revoked_at" timestamptz NULL, PRIMARY KEY ("id"));
-- create index "liveingress_live_id_protocol" to table: "live_ingresses"
CREATE UNIQUE INDEX "liveingress_live_id_protocol" ON "live_ingresses" ("live_id", "protocol") WHERE (state)::text = 'active'::text;
-- create index "liveingress_livekit_ingress_id" to table: "live_ingresses"
CREATE INDEX "liveingress_livekit_ingress_id" ON "live_ingresses" ("livekit_ingress_id");
-- create "live_recordings" table
CREATE TABLE "live_recordings" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "live_id" uuid NOT NULL, "egress_id" character varying NOT NULL, "state" character varying NOT NULL DEFAULT 'recording', "object_key" character varying NOT NULL, "duration_seconds" bigint NOT NULL DEFAULT 0, "size_bytes" bigint NOT NULL DEFAULT 0, "failure_reason" character varying NULL, "completed_at" timestamptz NULL, PRIMARY KEY ("id"));
-- create index "liverecording_egress_id" to table: "live_recordings"
CREATE UNIQUE INDEX "liverecording_egress_id" ON "live_recordings" ("egress_id");
-- create index "liverecording_live_id_id" to table: "live_recordings"
CREATE INDEX "liverecording_live_id_id" ON "live_recordings" ("live_id", "id");
-- create "overlay_scenes" table
CREATE TABLE "overlay_scenes" ("id" character varying NOT NULL, "created_at" timestamptz NOT NULL, "updated_at" timestamptz NOT NULL, "live_id" uuid NOT NULL, "owner_id" uuid NOT NULL, "name" character varying NOT NULL, "is_main" boolean NOT NULL DEFAULT false, "layers" jsonb NOT NULL, "published_layers" jsonb NULL, "published_name" character varying NULL, "published_at" timestamptz NULL, "revision" bigint NOT NULL DEFAULT 1, PRIMARY KEY ("id"));
-- create index "overlayscene_live_id" to table: "overlay_scenes"
CREATE UNIQUE INDEX "overlayscene_live_id" ON "overlay_scenes" ("live_id") WHERE is_main;
-- create index "overlayscene_live_id_created_at" to table: "overlay_scenes"
CREATE INDEX "overlayscene_live_id_created_at" ON "overlay_scenes" ("live_id", "created_at");
