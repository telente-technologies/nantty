-- reverse: create index "creatorbranddeal_creator_user_id_idempotency_key" to table: "creator_brand_deals"
DROP INDEX "creatorbranddeal_creator_user_id_idempotency_key";
-- reverse: create index "creatorbranddeal_creator_user_id_created_at" to table: "creator_brand_deals"
DROP INDEX "creatorbranddeal_creator_user_id_created_at";
-- reverse: create "creator_brand_deals" table
DROP TABLE "creator_brand_deals";
