-- modify "products" table
ALTER TABLE "products" ADD COLUMN "moderation_visibility" character varying NOT NULL DEFAULT 'visible';
-- modify "stores" table
ALTER TABLE "stores" ADD COLUMN "moderation_visibility" character varying NOT NULL DEFAULT 'visible';
-- create "featured_products" table
CREATE TABLE "featured_products" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "store_id" uuid NOT NULL, "product_id" uuid NOT NULL, "placement" character varying NOT NULL, "position" bigint NOT NULL, "featured_since" timestamptz NOT NULL, "view_count" bigint NOT NULL DEFAULT 0, "click_count" bigint NOT NULL DEFAULT 0, PRIMARY KEY ("id"));
-- create index "featuredproduct_placement_store_id" to table: "featured_products"
CREATE INDEX "featuredproduct_placement_store_id" ON "featured_products" ("placement", "store_id");
-- create index "featuredproduct_store_id_position" to table: "featured_products"
CREATE INDEX "featuredproduct_store_id_position" ON "featured_products" ("store_id", "position");
-- create index "featuredproduct_store_id_product_id" to table: "featured_products"
CREATE UNIQUE INDEX "featuredproduct_store_id_product_id" ON "featured_products" ("store_id", "product_id");
-- create "store_visitors" table
CREATE TABLE "store_visitors" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "store_id" uuid NOT NULL, "account_id" uuid NOT NULL, "visit_count" bigint NOT NULL DEFAULT 1, "last_visited_at" timestamptz NOT NULL, PRIMARY KEY ("id"));
-- create index "storevisitor_account_id" to table: "store_visitors"
CREATE INDEX "storevisitor_account_id" ON "store_visitors" ("account_id");
-- create index "storevisitor_store_id_account_id" to table: "store_visitors"
CREATE UNIQUE INDEX "storevisitor_store_id_account_id" ON "store_visitors" ("store_id", "account_id");
-- create index "storevisitor_store_id_last_visited_at" to table: "store_visitors"
CREATE INDEX "storevisitor_store_id_last_visited_at" ON "store_visitors" ("store_id", "last_visited_at");
