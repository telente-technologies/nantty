-- modify "ad_boosts" table
ALTER TABLE "ad_boosts" ADD COLUMN "destination_type" character varying NOT NULL DEFAULT 'post';
-- create index "adboost_destination_type_post_id" to table: "ad_boosts"
CREATE INDEX "adboost_destination_type_post_id" ON "ad_boosts" ("destination_type", "post_id");
