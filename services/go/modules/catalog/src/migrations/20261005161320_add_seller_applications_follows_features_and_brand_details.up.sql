-- modify "brands" table
ALTER TABLE "brands" ADD COLUMN "owner_account_id" uuid NULL, ADD COLUMN "description" character varying NOT NULL DEFAULT '', ADD COLUMN "cover_url" character varying NULL, ADD COLUMN "website" character varying NULL, ADD COLUMN "category_id" uuid NULL, ADD COLUMN "category_name" character varying NOT NULL DEFAULT '', ADD COLUMN "country_code" character varying NOT NULL DEFAULT '', ADD COLUMN "official_status" character varying NOT NULL DEFAULT 'NONE', ADD COLUMN "follower_count" bigint NOT NULL DEFAULT 0, ADD COLUMN "updated_at" timestamptz NOT NULL DEFAULT now();
ALTER TABLE "brands" ALTER COLUMN "updated_at" DROP DEFAULT;
UPDATE "brands" SET "official_status" = 'OFFICIAL' WHERE "official";
-- create index "brand_official_status_id" to table: "brands"
CREATE INDEX "brand_official_status_id" ON "brands" ("official_status", "id");
-- create index "brand_owner_account_id" to table: "brands"
CREATE INDEX "brand_owner_account_id" ON "brands" ("owner_account_id");
-- modify "categories" table
ALTER TABLE "categories" ADD COLUMN "icon_name" character varying NULL;
-- create index "category_platform_slug_unique" to table: "categories"
CREATE UNIQUE INDEX "category_platform_slug_unique" ON "categories" ("slug") WHERE (store_id IS NULL);
-- modify "stores" table
ALTER TABLE "stores" ADD COLUMN "status_reason" character varying NULL, ADD COLUMN "status_changed_at" timestamptz NULL, ADD COLUMN "brand_id" uuid NULL, ADD COLUMN "has_official_badge" boolean NOT NULL DEFAULT false, ADD COLUMN "follower_count" bigint NOT NULL DEFAULT 0;
-- create index "store_brand_id" to table: "stores"
CREATE INDEX "store_brand_id" ON "stores" ("brand_id");
-- create index "store_status_id" to table: "stores"
CREATE INDEX "store_status_id" ON "stores" ("status", "id");
-- create "brand_official_requests" table
CREATE TABLE "brand_official_requests" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "brand_id" uuid NOT NULL, "submitted_by_account_id" uuid NULL, "trademark" jsonb NOT NULL, "cac_registration_number" character varying NOT NULL DEFAULT '', "cac_company_name" character varying NOT NULL DEFAULT '', "contact_email" character varying NOT NULL DEFAULT '', "documents" jsonb NULL, "last_decision_reason" character varying NULL, "decided_at" timestamptz NULL, "decided_by_name" character varying NULL, "updated_at" timestamptz NOT NULL, PRIMARY KEY ("id"));
-- create index "brandofficialrequest_brand_id_id" to table: "brand_official_requests"
CREATE INDEX "brandofficialrequest_brand_id_id" ON "brand_official_requests" ("brand_id", "id");
-- create "catalog_follows" table
CREATE TABLE "catalog_follows" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "target_kind" character varying NOT NULL, "target_id" uuid NOT NULL, "account_id" uuid NOT NULL, PRIMARY KEY ("id"));
-- create index "catalogfollow_account_id_target_kind_id" to table: "catalog_follows"
CREATE INDEX "catalogfollow_account_id_target_kind_id" ON "catalog_follows" ("account_id", "target_kind", "id" DESC);
-- create index "catalogfollow_target_kind_target_id_account_id" to table: "catalog_follows"
CREATE UNIQUE INDEX "catalogfollow_target_kind_target_id_account_id" ON "catalog_follows" ("target_kind", "target_id", "account_id");
-- create "mart_features" table
CREATE TABLE "mart_features" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "title" character varying NOT NULL, "subtitle" character varying NULL, "kind" character varying NOT NULL, "image_id" character varying NOT NULL, "target_type" character varying NOT NULL, "target_value" character varying NOT NULL, "countries" jsonb NOT NULL, "starts_at" timestamptz NOT NULL, "ends_at" timestamptz NULL, "priority" bigint NOT NULL, "is_published" boolean NOT NULL DEFAULT false, "updated_at" timestamptz NOT NULL, PRIMARY KEY ("id"));
-- create index "martfeature_is_published_starts_at" to table: "mart_features"
CREATE INDEX "martfeature_is_published_starts_at" ON "mart_features" ("is_published", "starts_at");
-- create index "martfeature_priority" to table: "mart_features"
CREATE INDEX "martfeature_priority" ON "mart_features" ("priority");
-- create "seller_applications" table
CREATE TABLE "seller_applications" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "account_id" uuid NOT NULL, "status" character varying NOT NULL DEFAULT 'pending', "store_name" character varying NOT NULL, "category_id" uuid NOT NULL, "category_name" character varying NOT NULL DEFAULT '', "description" character varying NOT NULL DEFAULT '', "phone_sealed" bytea NOT NULL, "address_line" character varying NOT NULL, "city" character varying NOT NULL, "state" character varying NOT NULL, "identity_document_type" character varying NOT NULL, "identity_document_number_sealed" bytea NOT NULL, "identity_document_last4" character varying NOT NULL, "identity_document_photo_url" character varying NOT NULL, "payout_bank_code" character varying NOT NULL, "payout_bank_name" character varying NOT NULL DEFAULT '', "payout_account_number_sealed" bytea NOT NULL, "payout_account_last4" character varying NOT NULL, "reviewed_at" timestamptz NULL, "reviewed_by_id" character varying NULL, "reviewed_by_name" character varying NULL, "decision_reason" character varying NULL, "updated_at" timestamptz NOT NULL, PRIMARY KEY ("id"));
-- create index "sellerapplication_account_id_id" to table: "seller_applications"
CREATE INDEX "sellerapplication_account_id_id" ON "seller_applications" ("account_id", "id");
-- create index "sellerapplication_one_pending_per_account" to table: "seller_applications"
CREATE UNIQUE INDEX "sellerapplication_one_pending_per_account" ON "seller_applications" ("account_id") WHERE ((status)::text = 'pending'::text);
-- create index "sellerapplication_status_id" to table: "seller_applications"
CREATE INDEX "sellerapplication_status_id" ON "seller_applications" ("status", "id");
