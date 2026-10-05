-- create "product_daily_views" table
CREATE TABLE "product_daily_views" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "store_id" uuid NOT NULL, "product_id" uuid NOT NULL, "day" character varying NOT NULL, "views" bigint NOT NULL DEFAULT 0, PRIMARY KEY ("id"));
-- create index "productdailyview_product_id_day" to table: "product_daily_views"
CREATE UNIQUE INDEX "productdailyview_product_id_day" ON "product_daily_views" ("product_id", "day");
-- create index "productdailyview_store_id_day" to table: "product_daily_views"
CREATE INDEX "productdailyview_store_id_day" ON "product_daily_views" ("store_id", "day");
-- create "store_daily_traffics" table
CREATE TABLE "store_daily_traffics" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "store_id" uuid NOT NULL, "day" character varying NOT NULL, "store_views" bigint NOT NULL DEFAULT 0, "product_views" bigint NOT NULL DEFAULT 0, "visitors" bigint NOT NULL DEFAULT 0, PRIMARY KEY ("id"));
-- create index "storedailytraffic_store_id_day" to table: "store_daily_traffics"
CREATE UNIQUE INDEX "storedailytraffic_store_id_day" ON "store_daily_traffics" ("store_id", "day");
