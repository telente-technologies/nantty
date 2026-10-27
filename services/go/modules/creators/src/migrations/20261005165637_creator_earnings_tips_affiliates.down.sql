REVOKE SELECT ON "creator_violations" FROM nantty_readers;
-- reverse: create index "tiptransaction_sender_user_id_idempotency_key" to table: "tip_transactions"
DROP INDEX "tiptransaction_sender_user_id_idempotency_key";
-- reverse: create index "tiptransaction_creator_user_id_created_at" to table: "tip_transactions"
DROP INDEX "tiptransaction_creator_user_id_created_at";
-- reverse: create "tip_transactions" table
DROP TABLE "tip_transactions";
-- reverse: create index "creatorviolation_user_id_created_at" to table: "creator_violations"
DROP INDEX "creatorviolation_user_id_created_at";
-- reverse: create "creator_violations" table
DROP TABLE "creator_violations";
-- reverse: create index "creatorearning_reference" to table: "creator_earnings"
DROP INDEX "creatorearning_reference";
-- reverse: create index "creatorearning_creator_id_kind_created_at" to table: "creator_earnings"
DROP INDEX "creatorearning_creator_id_kind_created_at";
-- reverse: create index "creatorearning_creator_id_created_at" to table: "creator_earnings"
DROP INDEX "creatorearning_creator_id_created_at";
-- reverse: create "creator_earnings" table
DROP TABLE "creator_earnings";
-- reverse: create index "creatoraffiliation_store_id_status_created_at" to table: "creator_affiliations"
DROP INDEX "creatoraffiliation_store_id_status_created_at";
-- reverse: create index "creator_affiliations_open" to table: "creator_affiliations"
DROP INDEX "creator_affiliations_open";
-- reverse: create "creator_affiliations" table
DROP TABLE "creator_affiliations";
-- reverse: create "affiliate_program_settings" table
DROP TABLE "affiliate_program_settings";
-- reverse: create index "affiliateproductcommission_store_id_product_id" to table: "affiliate_product_commissions"
DROP INDEX "affiliateproductcommission_store_id_product_id";
-- reverse: create "affiliate_product_commissions" table
DROP TABLE "affiliate_product_commissions";
-- reverse: create index "affiliatecommission_store_id_created_at" to table: "affiliate_commissions"
DROP INDEX "affiliatecommission_store_id_created_at";
DROP INDEX "affiliatecommission_order_item_id";
DROP INDEX "affiliatecommission_order_id";
-- reverse: create index "affiliatecommission_creator_id_created_at" to table: "affiliate_commissions"
DROP INDEX "affiliatecommission_creator_id_created_at";
-- reverse: create "affiliate_commissions" table
DROP TABLE "affiliate_commissions";
-- reverse: modify "creator_program_members" table
ALTER TABLE "creator_program_members" DROP COLUMN "suspended_at", DROP COLUMN "suspension_reason";
