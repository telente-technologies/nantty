-- modify "live_recordings" table
ALTER TABLE "live_recordings" ADD COLUMN "reposted_at" timestamptz NULL, ADD COLUMN "reposted_post_id" character varying NULL, ADD COLUMN "legal_hold" boolean NOT NULL DEFAULT false;
-- create index "liverecording_created_at" to table: "live_recordings"
CREATE INDEX "liverecording_created_at" ON "live_recordings" ("created_at") WHERE ((reposted_at IS NULL) AND (legal_hold = false));
