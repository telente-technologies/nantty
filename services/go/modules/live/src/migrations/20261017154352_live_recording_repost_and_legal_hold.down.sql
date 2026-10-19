-- reverse: create index "liverecording_created_at" to table: "live_recordings"
DROP INDEX "liverecording_created_at";
-- reverse: modify "live_recordings" table
ALTER TABLE "live_recordings" DROP COLUMN "legal_hold", DROP COLUMN "reposted_post_id", DROP COLUMN "reposted_at";
