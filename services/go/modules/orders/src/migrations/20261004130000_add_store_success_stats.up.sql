-- create index "ordergroup_created" to table: "order_groups"
CREATE INDEX "ordergroup_created" ON "order_groups" ("created_at");
-- create "store_success_stats" table
CREATE TABLE "store_success_stats" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "store_id" uuid NOT NULL, "settled_orders" bigint NOT NULL DEFAULT 0, "successful_orders" bigint NOT NULL DEFAULT 0, "computed_at" timestamptz NOT NULL, PRIMARY KEY ("id"));
-- create index "storesuccessstat_store_id" to table: "store_success_stats"
CREATE UNIQUE INDEX "storesuccessstat_store_id" ON "store_success_stats" ("store_id");
