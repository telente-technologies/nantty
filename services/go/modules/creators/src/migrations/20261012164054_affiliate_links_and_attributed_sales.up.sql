-- modify "affiliate_commissions" table
ALTER TABLE "affiliate_commissions" ADD COLUMN "product_name" character varying NOT NULL DEFAULT '', ADD COLUMN "store_name" character varying NOT NULL DEFAULT '', ADD COLUMN "creator_handle" character varying NOT NULL DEFAULT '';
-- create "affiliate_attributed_sales" table
CREATE TABLE "affiliate_attributed_sales" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "order_id" character varying NOT NULL, "order_number" character varying NOT NULL DEFAULT '', "order_item_id" character varying NOT NULL, "product_id" character varying NOT NULL, "product_name" character varying NOT NULL DEFAULT '', "store_id" character varying NOT NULL, "store_name" character varying NOT NULL DEFAULT '', "seller_user_id" character varying NOT NULL, "creator_id" character varying NOT NULL, "attribution_source" character varying NOT NULL, "attribution_id" character varying NOT NULL, "sale_minor" bigint NOT NULL, "commission_bps" bigint NOT NULL, "estimated_commission_minor" bigint NOT NULL, "currency" character varying NOT NULL, "status" character varying NOT NULL DEFAULT 'awaiting', "void_reason" character varying NOT NULL DEFAULT '', "ordered_at" timestamptz NULL, "decided_at" timestamptz NULL, "updated_at" timestamptz NOT NULL, PRIMARY KEY ("id"));
-- create index "affiliateattributedsale_creator_id_status_created_at" to table: "affiliate_attributed_sales"
CREATE INDEX "affiliateattributedsale_creator_id_status_created_at" ON "affiliate_attributed_sales" ("creator_id", "status", "created_at");
-- create index "affiliateattributedsale_order_id" to table: "affiliate_attributed_sales"
CREATE INDEX "affiliateattributedsale_order_id" ON "affiliate_attributed_sales" ("order_id");
-- create index "affiliateattributedsale_order_item_id" to table: "affiliate_attributed_sales"
CREATE UNIQUE INDEX "affiliateattributedsale_order_item_id" ON "affiliate_attributed_sales" ("order_item_id");
-- create "affiliate_links" table
CREATE TABLE "affiliate_links" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "creator_id" character varying NOT NULL, "store_id" character varying NOT NULL, "product_id" character varying NOT NULL, "clicks" bigint NOT NULL DEFAULT 0, "last_clicked_at" timestamptz NULL, PRIMARY KEY ("id"));
-- create index "affiliatelink_creator_id_created_at" to table: "affiliate_links"
CREATE INDEX "affiliatelink_creator_id_created_at" ON "affiliate_links" ("creator_id", "created_at");
-- create index "affiliatelink_creator_id_product_id" to table: "affiliate_links"
CREATE UNIQUE INDEX "affiliatelink_creator_id_product_id" ON "affiliate_links" ("creator_id", "product_id");
