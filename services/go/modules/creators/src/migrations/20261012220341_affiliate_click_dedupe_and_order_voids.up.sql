-- create "affiliate_link_visits" table
CREATE TABLE "affiliate_link_visits" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "link_id" character varying NOT NULL, "viewer_key" character varying NOT NULL, "last_counted_at" timestamptz NOT NULL, PRIMARY KEY ("id"));
-- create index "affiliatelinkvisit_link_id_viewer_key" to table: "affiliate_link_visits"
CREATE UNIQUE INDEX "affiliatelinkvisit_link_id_viewer_key" ON "affiliate_link_visits" ("link_id", "viewer_key");
-- create "affiliate_order_voids" table
CREATE TABLE "affiliate_order_voids" ("id" character varying NOT NULL, "reason" character varying NOT NULL DEFAULT '', "created_at" timestamptz NOT NULL, PRIMARY KEY ("id"));
