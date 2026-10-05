-- drop index "checkout_open_expiry" from table: "checkouts"
DROP INDEX "checkout_open_expiry";
-- create index "checkout_open_expiry" to table: "checkouts"
CREATE INDEX "checkout_open_expiry" ON "checkouts" ("expires_at") WHERE ((status)::text = ANY ((ARRAY['registering'::character varying, 'payable'::character varying])::text[]));
-- modify "order_groups" table
ALTER TABLE "order_groups" ALTER COLUMN "payment_mode" TYPE character varying;
-- create "customer_segments" table
CREATE TABLE "customer_segments" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "store_id" uuid NOT NULL, "name" character varying NOT NULL, "description" character varying NOT NULL DEFAULT '', "rules" jsonb NOT NULL, "updated_at" timestamptz NOT NULL, PRIMARY KEY ("id"));
-- create index "customersegment_store_id_id" to table: "customer_segments"
CREATE INDEX "customersegment_store_id_id" ON "customer_segments" ("store_id", "id");
-- create "delivery_areas" table
CREATE TABLE "delivery_areas" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "store_id" uuid NOT NULL, "name" character varying NOT NULL, "state" character varying NOT NULL, "cities" jsonb NOT NULL, "fee_minor" bigint NOT NULL, "currency" character varying NOT NULL, "estimated_days_min" bigint NOT NULL, "estimated_days_max" bigint NOT NULL, "active" boolean NOT NULL DEFAULT true, "updated_at" timestamptz NOT NULL, PRIMARY KEY ("id"));
-- create index "deliveryarea_store_id_id" to table: "delivery_areas"
CREATE INDEX "deliveryarea_store_id_id" ON "delivery_areas" ("store_id", "id");
-- create "store_customer_profiles" table
CREATE TABLE "store_customer_profiles" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "store_id" uuid NOT NULL, "buyer_account_id" uuid NULL, "name" character varying NOT NULL DEFAULT '', "phone" character varying NULL, "email" character varying NULL, "tags" jsonb NULL, "marketing_opt_in" boolean NOT NULL DEFAULT false, "updated_at" timestamptz NOT NULL, PRIMARY KEY ("id"));
-- create index "storecustomerprofile_store_id_buyer_account_id" to table: "store_customer_profiles"
CREATE UNIQUE INDEX "storecustomerprofile_store_id_buyer_account_id" ON "store_customer_profiles" ("store_id", "buyer_account_id") WHERE (buyer_account_id IS NOT NULL);
-- create index "storecustomerprofile_store_id_email" to table: "store_customer_profiles"
CREATE INDEX "storecustomerprofile_store_id_email" ON "store_customer_profiles" ("store_id", "email");
-- create index "storecustomerprofile_store_id_phone" to table: "store_customer_profiles"
CREATE INDEX "storecustomerprofile_store_id_phone" ON "store_customer_profiles" ("store_id", "phone");
