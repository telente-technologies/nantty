-- modify "ad_boosts" table
ALTER TABLE "ad_boosts" ADD COLUMN "payment_top_up_id" character varying NOT NULL DEFAULT '';
-- create index "adboost_payment_top_up_id" to table: "ad_boosts"
CREATE INDEX "adboost_payment_top_up_id" ON "ad_boosts" ("payment_top_up_id");
-- create "ad_free_boost_grants" table
CREATE TABLE "ad_free_boost_grants" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "user_id" uuid NOT NULL, "period_key" character varying NOT NULL, "boost_id" uuid NOT NULL, "value_minor" bigint NOT NULL, "currency" character varying NOT NULL, PRIMARY KEY ("id"));
-- create index "adfreeboostgrant_boost_id" to table: "ad_free_boost_grants"
CREATE UNIQUE INDEX "adfreeboostgrant_boost_id" ON "ad_free_boost_grants" ("boost_id");
-- create index "adfreeboostgrant_user_id_period_key" to table: "ad_free_boost_grants"
CREATE UNIQUE INDEX "adfreeboostgrant_user_id_period_key" ON "ad_free_boost_grants" ("user_id", "period_key");
