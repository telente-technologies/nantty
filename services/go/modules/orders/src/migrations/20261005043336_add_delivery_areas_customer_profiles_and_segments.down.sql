-- reverse: create index "storecustomerprofile_store_id_phone" to table: "store_customer_profiles"
DROP INDEX "storecustomerprofile_store_id_phone";
-- reverse: create index "storecustomerprofile_store_id_email" to table: "store_customer_profiles"
DROP INDEX "storecustomerprofile_store_id_email";
-- reverse: create index "storecustomerprofile_store_id_buyer_account_id" to table: "store_customer_profiles"
DROP INDEX "storecustomerprofile_store_id_buyer_account_id";
-- reverse: create "store_customer_profiles" table
DROP TABLE "store_customer_profiles";
-- reverse: create index "deliveryarea_store_id_id" to table: "delivery_areas"
DROP INDEX "deliveryarea_store_id_id";
-- reverse: create "delivery_areas" table
DROP TABLE "delivery_areas";
-- reverse: create index "customersegment_store_id_id" to table: "customer_segments"
DROP INDEX "customersegment_store_id_id";
-- reverse: create "customer_segments" table
DROP TABLE "customer_segments";
-- reverse: modify "order_groups" table
ALTER TABLE "order_groups" ALTER COLUMN "payment_mode" TYPE character varying(10);
-- reverse: create index "checkout_open_expiry" to table: "checkouts"
DROP INDEX "checkout_open_expiry";
-- reverse: drop index "checkout_open_expiry" from table: "checkouts"
CREATE INDEX "checkout_open_expiry" ON "checkouts" ("expires_at") WHERE ((status)::text = ANY (ARRAY[('registering'::character varying)::text, ('payable'::character varying)::text]));
