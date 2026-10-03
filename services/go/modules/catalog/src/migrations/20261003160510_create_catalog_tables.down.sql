-- reverse: create index "storemember_store_id_account_id" to table: "store_members"
DROP INDEX "storemember_store_id_account_id";
-- reverse: create index "storemember_account_id_status" to table: "store_members"
DROP INDEX "storemember_account_id_status";
-- reverse: create "store_members" table
DROP TABLE "store_members";
-- reverse: create index "store_slug" to table: "stores"
DROP INDEX "store_slug";
-- reverse: create index "store_owner_account_id" to table: "stores"
DROP INDEX "store_owner_account_id";
-- reverse: create index "store_business_profile_id" to table: "stores"
DROP INDEX "store_business_profile_id";
-- reverse: create "stores" table
DROP TABLE "stores";
-- reverse: create index "review_store_newest" to table: "reviews"
DROP INDEX "review_store_newest";
-- reverse: create index "review_product_newest" to table: "reviews"
DROP INDEX "review_product_newest";
-- reverse: create index "review_author_store_unique" to table: "reviews"
DROP INDEX "review_author_store_unique";
-- reverse: create index "review_author_product_unique" to table: "reviews"
DROP INDEX "review_author_product_unique";
-- reverse: create "reviews" table
DROP TABLE "reviews";
-- reverse: create index "productvariant_store_id_sku_key" to table: "product_variants"
DROP INDEX "productvariant_store_id_sku_key";
-- reverse: create index "productvariant_store_barcode_unique" to table: "product_variants"
DROP INDEX "productvariant_store_barcode_unique";
-- reverse: create index "productvariant_product_id_position" to table: "product_variants"
DROP INDEX "productvariant_product_id_position";
-- reverse: create "product_variants" table
DROP TABLE "product_variants";
-- reverse: create index "productreaction_product_id_account_id_kind" to table: "product_reactions"
DROP INDEX "productreaction_product_id_account_id_kind";
-- reverse: create index "productreaction_account_id_kind_id" to table: "product_reactions"
DROP INDEX "productreaction_account_id_kind_id";
-- reverse: create "product_reactions" table
DROP TABLE "product_reactions";
-- reverse: create index "productmedia_product_id_position" to table: "product_media"
DROP INDEX "productmedia_product_id_position";
-- reverse: create index "productmedia_product_id_media_id" to table: "product_media"
DROP INDEX "productmedia_product_id_media_id";
-- reverse: create "product_media" table
DROP TABLE "product_media";
-- reverse: create index "product_supplier_id" to table: "products"
DROP INDEX "product_supplier_id";
-- reverse: create index "product_store_status_updated" to table: "products"
DROP INDEX "product_store_status_updated";
-- reverse: create index "product_store_status_published" to table: "products"
DROP INDEX "product_store_status_published";
-- reverse: create index "product_scheduled_due" to table: "products"
DROP INDEX "product_scheduled_due";
-- reverse: create index "product_mart_listed" to table: "products"
DROP INDEX "product_mart_listed";
-- reverse: create index "product_category_listed" to table: "products"
DROP INDEX "product_category_listed";
-- reverse: create index "product_brand_id" to table: "products"
DROP INDEX "product_brand_id";
-- reverse: create "products" table
DROP TABLE "products";
-- reverse: create index "outboxevent_published_at_created_at" to table: "outbox_events"
DROP INDEX "outboxevent_published_at_created_at";
-- reverse: create "outbox_events" table
DROP TABLE "outbox_events";
-- reverse: create index "idempotentrequest_scope_key" to table: "idempotent_requests"
DROP INDEX "idempotentrequest_scope_key";
-- reverse: create "idempotent_requests" table
DROP TABLE "idempotent_requests";
-- reverse: create index "category_store_id_slug" to table: "categories"
DROP INDEX "category_store_id_slug";
-- reverse: create index "category_store_id_id" to table: "categories"
DROP INDEX "category_store_id_id";
-- reverse: create index "category_parent_id_sort_order" to table: "categories"
DROP INDEX "category_parent_id_sort_order";
-- reverse: create "categories" table
DROP TABLE "categories";
-- reverse: create index "brand_slug" to table: "brands"
DROP INDEX "brand_slug";
-- reverse: create index "brand_active_name" to table: "brands"
DROP INDEX "brand_active_name";
-- reverse: create "brands" table
DROP TABLE "brands";
