-- create "brands" table
CREATE TABLE "brands" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "name" character varying NOT NULL, "slug" character varying NOT NULL, "logo_url" character varying NULL, "owner_profile_id" uuid NULL, "official" boolean NOT NULL DEFAULT false, "active" boolean NOT NULL DEFAULT true, PRIMARY KEY ("id"));
-- create index "brand_active_name" to table: "brands"
CREATE INDEX "brand_active_name" ON "brands" ("active", "name");
-- create index "brand_slug" to table: "brands"
CREATE UNIQUE INDEX "brand_slug" ON "brands" ("slug");
-- create "categories" table
CREATE TABLE "categories" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "store_id" uuid NULL, "parent_id" uuid NULL, "name" character varying NOT NULL, "slug" character varying NOT NULL, "description" character varying NOT NULL DEFAULT '', "path" character varying NOT NULL DEFAULT '', "depth" bigint NOT NULL DEFAULT 0, "attribute_definitions" jsonb NULL, "sort_order" bigint NOT NULL DEFAULT 0, "active" boolean NOT NULL DEFAULT true, "updated_at" timestamptz NOT NULL, PRIMARY KEY ("id"));
-- create index "category_parent_id_sort_order" to table: "categories"
CREATE INDEX "category_parent_id_sort_order" ON "categories" ("parent_id", "sort_order");
-- create index "category_store_id_id" to table: "categories"
CREATE INDEX "category_store_id_id" ON "categories" ("store_id", "id");
-- create index "category_store_id_slug" to table: "categories"
CREATE UNIQUE INDEX "category_store_id_slug" ON "categories" ("store_id", "slug");
-- create "idempotent_requests" table
CREATE TABLE "idempotent_requests" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "scope" character varying NOT NULL, "key" character varying NOT NULL, "request_hash" character varying NOT NULL, "response_body" jsonb NULL, PRIMARY KEY ("id"));
-- create index "idempotentrequest_scope_key" to table: "idempotent_requests"
CREATE UNIQUE INDEX "idempotentrequest_scope_key" ON "idempotent_requests" ("scope", "key");
-- create "outbox_events" table
CREATE TABLE "outbox_events" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "event_type" character varying NOT NULL, "subject" character varying NOT NULL, "payload" jsonb NOT NULL, "published_at" timestamptz NULL, PRIMARY KEY ("id"));
-- create index "outboxevent_published_at_created_at" to table: "outbox_events"
CREATE INDEX "outboxevent_published_at_created_at" ON "outbox_events" ("published_at", "created_at");
-- create "products" table
CREATE TABLE "products" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "store_id" uuid NOT NULL, "name" character varying NOT NULL, "description" character varying NOT NULL DEFAULT '', "category_id" uuid NULL, "brand_id" uuid NULL, "brand_relationship" character varying NULL, "status" character varying NOT NULL DEFAULT 'draft', "visibility" character varying NOT NULL DEFAULT 'public', "published_online" boolean NOT NULL DEFAULT false, "taxable" boolean NOT NULL DEFAULT true, "track_inventory" boolean NOT NULL DEFAULT true, "tags" jsonb NULL, "options" jsonb NULL, "attributes" jsonb NULL, "videos" jsonb NULL, "supplier_id" uuid NULL, "currency" character varying NOT NULL, "min_price_minor" bigint NOT NULL DEFAULT 0, "publish_at" timestamptz NULL, "published_at" timestamptz NULL, "rating_sum" bigint NOT NULL DEFAULT 0, "rating_count" bigint NOT NULL DEFAULT 0, "like_count" bigint NOT NULL DEFAULT 0, "units_sold" bigint NOT NULL DEFAULT 0, "updated_at" timestamptz NOT NULL, PRIMARY KEY ("id"));
-- create index "product_brand_id" to table: "products"
CREATE INDEX "product_brand_id" ON "products" ("brand_id");
-- create index "product_category_listed" to table: "products"
CREATE INDEX "product_category_listed" ON "products" ("category_id", "published_at" DESC, "id" DESC) WHERE (((status)::text = 'active'::text) AND ((visibility)::text = 'public'::text) AND published_online);
-- create index "product_mart_listed" to table: "products"
CREATE INDEX "product_mart_listed" ON "products" ("published_at" DESC, "id" DESC) WHERE (((status)::text = 'active'::text) AND ((visibility)::text = 'public'::text) AND published_online);
-- create index "product_scheduled_due" to table: "products"
CREATE INDEX "product_scheduled_due" ON "products" ("publish_at") WHERE (((status)::text = 'draft'::text) AND (publish_at IS NOT NULL));
-- create index "product_store_status_published" to table: "products"
CREATE INDEX "product_store_status_published" ON "products" ("store_id", "status", "published_at" DESC, "id" DESC);
-- create index "product_store_status_updated" to table: "products"
CREATE INDEX "product_store_status_updated" ON "products" ("store_id", "status", "updated_at" DESC, "id" DESC);
-- create index "product_supplier_id" to table: "products"
CREATE INDEX "product_supplier_id" ON "products" ("supplier_id");
-- create "product_media" table
CREATE TABLE "product_media" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "product_id" uuid NOT NULL, "media_id" character varying NOT NULL, "url" character varying NOT NULL, "kind" character varying NOT NULL DEFAULT 'image', "position" bigint NOT NULL DEFAULT 0, PRIMARY KEY ("id"));
-- create index "productmedia_product_id_media_id" to table: "product_media"
CREATE UNIQUE INDEX "productmedia_product_id_media_id" ON "product_media" ("product_id", "media_id");
-- create index "productmedia_product_id_position" to table: "product_media"
CREATE INDEX "productmedia_product_id_position" ON "product_media" ("product_id", "position");
-- create "product_reactions" table
CREATE TABLE "product_reactions" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "product_id" uuid NOT NULL, "account_id" uuid NOT NULL, "kind" character varying NOT NULL, PRIMARY KEY ("id"));
-- create index "productreaction_account_id_kind_id" to table: "product_reactions"
CREATE INDEX "productreaction_account_id_kind_id" ON "product_reactions" ("account_id", "kind", "id" DESC);
-- create index "productreaction_product_id_account_id_kind" to table: "product_reactions"
CREATE UNIQUE INDEX "productreaction_product_id_account_id_kind" ON "product_reactions" ("product_id", "account_id", "kind");
-- create "product_variants" table
CREATE TABLE "product_variants" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "product_id" uuid NOT NULL, "store_id" uuid NOT NULL, "title" character varying NOT NULL, "option_values" jsonb NULL, "size" character varying NOT NULL DEFAULT '', "color" character varying NOT NULL DEFAULT '', "sku" character varying NOT NULL, "sku_key" character varying NOT NULL, "barcode" character varying NULL, "price_minor" bigint NOT NULL, "compare_at_price_minor" bigint NULL, "cost_price_minor" bigint NULL, "low_stock_threshold" bigint NOT NULL DEFAULT 5, "reorder_point" bigint NOT NULL DEFAULT 5, "reorder_quantity" bigint NOT NULL DEFAULT 10, "position" bigint NOT NULL DEFAULT 0, "updated_at" timestamptz NOT NULL, PRIMARY KEY ("id"));
-- create index "productvariant_product_id_position" to table: "product_variants"
CREATE INDEX "productvariant_product_id_position" ON "product_variants" ("product_id", "position");
-- create index "productvariant_store_barcode_unique" to table: "product_variants"
CREATE UNIQUE INDEX "productvariant_store_barcode_unique" ON "product_variants" ("store_id", "barcode") WHERE (barcode IS NOT NULL);
-- create index "productvariant_store_id_sku_key" to table: "product_variants"
CREATE UNIQUE INDEX "productvariant_store_id_sku_key" ON "product_variants" ("store_id", "sku_key");
-- create "reviews" table
CREATE TABLE "reviews" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "kind" character varying NOT NULL, "store_id" uuid NOT NULL, "product_id" uuid NULL, "author_account_id" uuid NOT NULL, "order_number" character varying NULL, "verified_purchase" boolean NOT NULL DEFAULT false, "rating" bigint NOT NULL, "title" character varying NULL, "body" character varying NOT NULL, "photo_count" bigint NOT NULL DEFAULT 0, "helpful_count" bigint NOT NULL DEFAULT 0, "status" character varying NOT NULL DEFAULT 'published', "report_reason" character varying NULL, "report_details" character varying NULL, "reply_body" character varying NULL, "reply_author_name" character varying NULL, "reply_created_at" timestamptz NULL, "reply_updated_at" timestamptz NULL, "updated_at" timestamptz NOT NULL, PRIMARY KEY ("id"));
-- create index "review_author_product_unique" to table: "reviews"
CREATE UNIQUE INDEX "review_author_product_unique" ON "reviews" ("author_account_id", "product_id") WHERE (product_id IS NOT NULL);
-- create index "review_author_store_unique" to table: "reviews"
CREATE UNIQUE INDEX "review_author_store_unique" ON "reviews" ("author_account_id", "store_id") WHERE ((kind)::text = 'store'::text);
-- create index "review_product_newest" to table: "reviews"
CREATE INDEX "review_product_newest" ON "reviews" ("product_id", "id" DESC);
-- create index "review_store_newest" to table: "reviews"
CREATE INDEX "review_store_newest" ON "reviews" ("store_id", "kind", "id" DESC);
-- create "stores" table
CREATE TABLE "stores" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "owner_account_id" uuid NOT NULL, "business_profile_id" uuid NOT NULL, "name" character varying NOT NULL, "slug" character varying NOT NULL, "description" character varying NOT NULL DEFAULT '', "logo_url" character varying NULL, "banner_url" character varying NULL, "country_code" character varying NOT NULL, "currency" character varying NOT NULL, "timezone" character varying NOT NULL DEFAULT 'Africa/Lagos', "status" character varying NOT NULL DEFAULT 'active', "verified" boolean NOT NULL DEFAULT false, "rating_sum" bigint NOT NULL DEFAULT 0, "rating_count" bigint NOT NULL DEFAULT 0, "updated_at" timestamptz NOT NULL, PRIMARY KEY ("id"));
-- create index "store_business_profile_id" to table: "stores"
CREATE UNIQUE INDEX "store_business_profile_id" ON "stores" ("business_profile_id");
-- create index "store_owner_account_id" to table: "stores"
CREATE INDEX "store_owner_account_id" ON "stores" ("owner_account_id");
-- create index "store_slug" to table: "stores"
CREATE UNIQUE INDEX "store_slug" ON "stores" ("slug");
-- create "store_members" table
CREATE TABLE "store_members" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "store_id" uuid NOT NULL, "account_id" uuid NOT NULL, "role" character varying NOT NULL, "permissions" jsonb NULL, "status" character varying NOT NULL DEFAULT 'active', "updated_at" timestamptz NOT NULL, PRIMARY KEY ("id"));
-- create index "storemember_account_id_status" to table: "store_members"
CREATE INDEX "storemember_account_id_status" ON "store_members" ("account_id", "status");
-- create index "storemember_store_id_account_id" to table: "store_members"
CREATE UNIQUE INDEX "storemember_store_id_account_id" ON "store_members" ("store_id", "account_id");
