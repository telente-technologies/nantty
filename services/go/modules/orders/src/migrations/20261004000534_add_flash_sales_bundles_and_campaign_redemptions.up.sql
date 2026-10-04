-- create "campaign_redemptions" table
CREATE TABLE "campaign_redemptions" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "order_group_id" uuid NOT NULL, "store_id" uuid NOT NULL, "buyer_account_id" uuid NOT NULL, "campaign_kind" character varying NOT NULL, "campaign_id" uuid NOT NULL, "units" bigint NOT NULL, "discount_minor" bigint NOT NULL, "revenue_minor" bigint NOT NULL, PRIMARY KEY ("id"));
-- create index "campaignredemption_campaign_id" to table: "campaign_redemptions"
CREATE INDEX "campaignredemption_campaign_id" ON "campaign_redemptions" ("campaign_id");
-- create index "campaignredemption_order_group_id_campaign_kind_campaign_id" to table: "campaign_redemptions"
CREATE UNIQUE INDEX "campaignredemption_order_group_id_campaign_kind_campaign_id" ON "campaign_redemptions" ("order_group_id", "campaign_kind", "campaign_id");
-- create index "campaignredemption_store_id_created_at" to table: "campaign_redemptions"
CREATE INDEX "campaignredemption_store_id_created_at" ON "campaign_redemptions" ("store_id", "created_at");
-- create "flash_sales" table
CREATE TABLE "flash_sales" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "store_id" uuid NOT NULL, "name" character varying NOT NULL, "starts_at" timestamptz NOT NULL, "ends_at" timestamptz NOT NULL, "paused" boolean NOT NULL DEFAULT false, "ended_at" timestamptz NULL, "reach" bigint NOT NULL DEFAULT 0, "revenue_minor" bigint NOT NULL DEFAULT 0, "currency" character varying NOT NULL, "updated_at" timestamptz NOT NULL, PRIMARY KEY ("id"));
-- create index "flashsale_store_id_ends_at" to table: "flash_sales"
CREATE INDEX "flashsale_store_id_ends_at" ON "flash_sales" ("store_id", "ends_at");
-- create index "flashsale_store_id_starts_at" to table: "flash_sales"
CREATE INDEX "flashsale_store_id_starts_at" ON "flash_sales" ("store_id", "starts_at");
-- create "flash_sale_items" table
CREATE TABLE "flash_sale_items" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "flash_sale_id" uuid NOT NULL, "store_id" uuid NOT NULL, "product_id" uuid NOT NULL, "position" bigint NOT NULL, "sale_price_minor" bigint NOT NULL, "original_price_minor" bigint NOT NULL, "stock_cap" bigint NULL, "sold_count" bigint NOT NULL DEFAULT 0, PRIMARY KEY ("id"));
-- create index "flashsaleitem_flash_sale_id_product_id" to table: "flash_sale_items"
CREATE UNIQUE INDEX "flashsaleitem_flash_sale_id_product_id" ON "flash_sale_items" ("flash_sale_id", "product_id");
-- create index "flashsaleitem_store_id_product_id" to table: "flash_sale_items"
CREATE INDEX "flashsaleitem_store_id_product_id" ON "flash_sale_items" ("store_id", "product_id");
-- create "product_bundles" table
CREATE TABLE "product_bundles" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "store_id" uuid NOT NULL, "name" character varying NOT NULL, "description" character varying NOT NULL DEFAULT '', "bundle_price_minor" bigint NOT NULL, "currency" character varying NOT NULL, "status" character varying NOT NULL DEFAULT 'draft', "sold_count" bigint NOT NULL DEFAULT 0, "revenue_minor" bigint NOT NULL DEFAULT 0, "updated_at" timestamptz NOT NULL, PRIMARY KEY ("id"));
-- create index "productbundle_store_id_status" to table: "product_bundles"
CREATE INDEX "productbundle_store_id_status" ON "product_bundles" ("store_id", "status");
-- create "product_bundle_items" table
CREATE TABLE "product_bundle_items" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "bundle_id" uuid NOT NULL, "product_id" uuid NOT NULL, "position" bigint NOT NULL, "quantity" bigint NOT NULL, PRIMARY KEY ("id"));
-- create index "productbundleitem_bundle_id_product_id" to table: "product_bundle_items"
CREATE UNIQUE INDEX "productbundleitem_bundle_id_product_id" ON "product_bundle_items" ("bundle_id", "product_id");
-- create index "productbundleitem_product_id" to table: "product_bundle_items"
CREATE INDEX "productbundleitem_product_id" ON "product_bundle_items" ("product_id");
