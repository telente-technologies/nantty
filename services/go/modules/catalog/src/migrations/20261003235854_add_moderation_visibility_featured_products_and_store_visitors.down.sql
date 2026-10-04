-- reverse: create index "storevisitor_store_id_last_visited_at" to table: "store_visitors"
DROP INDEX "storevisitor_store_id_last_visited_at";
-- reverse: create index "storevisitor_store_id_account_id" to table: "store_visitors"
DROP INDEX "storevisitor_store_id_account_id";
-- reverse: create index "storevisitor_account_id" to table: "store_visitors"
DROP INDEX "storevisitor_account_id";
-- reverse: create "store_visitors" table
DROP TABLE "store_visitors";
-- reverse: create index "featuredproduct_store_id_product_id" to table: "featured_products"
DROP INDEX "featuredproduct_store_id_product_id";
-- reverse: create index "featuredproduct_store_id_position" to table: "featured_products"
DROP INDEX "featuredproduct_store_id_position";
-- reverse: create index "featuredproduct_placement_store_id" to table: "featured_products"
DROP INDEX "featuredproduct_placement_store_id";
-- reverse: create "featured_products" table
DROP TABLE "featured_products";
-- reverse: modify "stores" table
ALTER TABLE "stores" DROP COLUMN "moderation_visibility";
-- reverse: modify "products" table
ALTER TABLE "products" DROP COLUMN "moderation_visibility";
