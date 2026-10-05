-- reverse: create index "sellerapplication_status_id" to table: "seller_applications"
DROP INDEX "sellerapplication_status_id";
-- reverse: create index "sellerapplication_one_pending_per_account" to table: "seller_applications"
DROP INDEX "sellerapplication_one_pending_per_account";
-- reverse: create index "sellerapplication_account_id_id" to table: "seller_applications"
DROP INDEX "sellerapplication_account_id_id";
-- reverse: create "seller_applications" table
DROP TABLE "seller_applications";
-- reverse: create index "martfeature_priority" to table: "mart_features"
DROP INDEX "martfeature_priority";
-- reverse: create index "martfeature_is_published_starts_at" to table: "mart_features"
DROP INDEX "martfeature_is_published_starts_at";
-- reverse: create "mart_features" table
DROP TABLE "mart_features";
-- reverse: create index "catalogfollow_target_kind_target_id_account_id" to table: "catalog_follows"
DROP INDEX "catalogfollow_target_kind_target_id_account_id";
-- reverse: create index "catalogfollow_account_id_target_kind_id" to table: "catalog_follows"
DROP INDEX "catalogfollow_account_id_target_kind_id";
-- reverse: create "catalog_follows" table
DROP TABLE "catalog_follows";
-- reverse: create index "brandofficialrequest_brand_id_id" to table: "brand_official_requests"
DROP INDEX "brandofficialrequest_brand_id_id";
-- reverse: create "brand_official_requests" table
DROP TABLE "brand_official_requests";
-- reverse: create index "store_status_id" to table: "stores"
DROP INDEX "store_status_id";
-- reverse: create index "store_brand_id" to table: "stores"
DROP INDEX "store_brand_id";
-- reverse: modify "stores" table
ALTER TABLE "stores" DROP COLUMN "has_official_badge", DROP COLUMN "brand_id", DROP COLUMN "status_changed_at", DROP COLUMN "status_reason";
-- reverse: create index "category_platform_slug_unique" to table: "categories"
DROP INDEX "category_platform_slug_unique";
-- reverse: modify "categories" table
ALTER TABLE "categories" DROP COLUMN "icon_name";
-- reverse: create index "brand_owner_account_id" to table: "brands"
DROP INDEX "brand_owner_account_id";
-- reverse: create index "brand_official_status_id" to table: "brands"
DROP INDEX "brand_official_status_id";
-- reverse: modify "brands" table
ALTER TABLE "brands" DROP COLUMN "updated_at", DROP COLUMN "follower_count", DROP COLUMN "official_status", DROP COLUMN "country_code", DROP COLUMN "category_name", DROP COLUMN "category_id", DROP COLUMN "website", DROP COLUMN "cover_url", DROP COLUMN "description", DROP COLUMN "owner_account_id";
