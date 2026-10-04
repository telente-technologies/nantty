-- create "ad_creator_monetisation_holds" table
CREATE TABLE "ad_creator_monetisation_holds" ("id" character varying NOT NULL, "is_paused" boolean NOT NULL DEFAULT false, "health_changed_at" timestamptz NOT NULL, "updated_at" timestamptz NOT NULL, PRIMARY KEY ("id"));
