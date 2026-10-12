-- modify "ad_content_signals" table
ALTER TABLE "ad_content_signals" ADD COLUMN "removed" boolean NOT NULL DEFAULT false;
-- create "ad_creator_program_members" table
CREATE TABLE "ad_creator_program_members" ("id" character varying NOT NULL, "approved" boolean NOT NULL DEFAULT false, "status_changed_at" timestamptz NOT NULL, "updated_at" timestamptz NOT NULL, PRIMARY KEY ("id"));
