-- reverse: create index "productbundleitem_product_id" to table: "product_bundle_items"
DROP INDEX "productbundleitem_product_id";
-- reverse: create index "productbundleitem_bundle_id_product_id" to table: "product_bundle_items"
DROP INDEX "productbundleitem_bundle_id_product_id";
-- reverse: create "product_bundle_items" table
DROP TABLE "product_bundle_items";
-- reverse: create index "productbundle_store_id_status" to table: "product_bundles"
DROP INDEX "productbundle_store_id_status";
-- reverse: create "product_bundles" table
DROP TABLE "product_bundles";
-- reverse: create index "flashsaleitem_store_id_product_id" to table: "flash_sale_items"
DROP INDEX "flashsaleitem_store_id_product_id";
-- reverse: create index "flashsaleitem_flash_sale_id_product_id" to table: "flash_sale_items"
DROP INDEX "flashsaleitem_flash_sale_id_product_id";
-- reverse: create "flash_sale_items" table
DROP TABLE "flash_sale_items";
-- reverse: create index "flashsale_store_id_starts_at" to table: "flash_sales"
DROP INDEX "flashsale_store_id_starts_at";
-- reverse: create index "flashsale_store_id_ends_at" to table: "flash_sales"
DROP INDEX "flashsale_store_id_ends_at";
-- reverse: create "flash_sales" table
DROP TABLE "flash_sales";
-- reverse: create index "campaignredemption_store_id_created_at" to table: "campaign_redemptions"
DROP INDEX "campaignredemption_store_id_created_at";
-- reverse: create index "campaignredemption_order_group_id_campaign_kind_campaign_id" to table: "campaign_redemptions"
DROP INDEX "campaignredemption_order_group_id_campaign_kind_campaign_id";
-- reverse: create index "campaignredemption_campaign_id" to table: "campaign_redemptions"
DROP INDEX "campaignredemption_campaign_id";
-- reverse: create "campaign_redemptions" table
DROP TABLE "campaign_redemptions";
