-- reverse: create index "affiliatelink_creator_id_product_id" to table: "affiliate_links"
DROP INDEX "affiliatelink_creator_id_product_id";
-- reverse: create index "affiliatelink_creator_id_created_at" to table: "affiliate_links"
DROP INDEX "affiliatelink_creator_id_created_at";
-- reverse: create "affiliate_links" table
DROP TABLE "affiliate_links";
-- reverse: create index "affiliateattributedsale_order_item_id" to table: "affiliate_attributed_sales"
DROP INDEX "affiliateattributedsale_order_item_id";
-- reverse: create index "affiliateattributedsale_order_id" to table: "affiliate_attributed_sales"
DROP INDEX "affiliateattributedsale_order_id";
-- reverse: create index "affiliateattributedsale_creator_id_status_created_at" to table: "affiliate_attributed_sales"
DROP INDEX "affiliateattributedsale_creator_id_status_created_at";
-- reverse: create "affiliate_attributed_sales" table
DROP TABLE "affiliate_attributed_sales";
-- reverse: modify "affiliate_commissions" table
ALTER TABLE "affiliate_commissions" DROP COLUMN "creator_handle", DROP COLUMN "store_name", DROP COLUMN "product_name";
