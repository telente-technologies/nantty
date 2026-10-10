-- reverse: create index "adfreeboostgrant_user_id_period_key" to table: "ad_free_boost_grants"
DROP INDEX "adfreeboostgrant_user_id_period_key";
-- reverse: create index "adfreeboostgrant_boost_id" to table: "ad_free_boost_grants"
DROP INDEX "adfreeboostgrant_boost_id";
-- reverse: create "ad_free_boost_grants" table
DROP TABLE "ad_free_boost_grants";
-- reverse: create index "adboost_payment_top_up_id" to table: "ad_boosts"
DROP INDEX "adboost_payment_top_up_id";
-- reverse: modify "ad_boosts" table
ALTER TABLE "ad_boosts" DROP COLUMN "payment_top_up_id";
