-- modify "cart_items" table
ALTER TABLE "cart_items" ADD COLUMN "attribution_source" character varying NULL, ADD COLUMN "attribution_id" uuid NULL;
-- modify "order_items" table
ALTER TABLE "order_items" ADD COLUMN "taxable" boolean NOT NULL DEFAULT true, ADD COLUMN "attribution_source" character varying NULL, ADD COLUMN "attribution_id" uuid NULL;
-- create "refund_records" table
CREATE TABLE "refund_records" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "order_group_id" uuid NOT NULL, "store_id" uuid NOT NULL, "buyer_account_id" uuid NOT NULL, "order_reference" character varying NOT NULL, "amount_minor" bigint NOT NULL, "currency" character varying NOT NULL, "source" character varying NOT NULL, "status" character varying NOT NULL DEFAULT 'processing', "reason" character varying NOT NULL DEFAULT '', "created_by_account_id" character varying NOT NULL DEFAULT '', "created_by_name" character varying NOT NULL DEFAULT '', "idempotency_key" character varying NULL, "request_hash" character varying NOT NULL DEFAULT '', "completed_at" timestamptz NULL, "updated_at" timestamptz NOT NULL, PRIMARY KEY ("id"));
-- create index "refundrecord_idempotency" to table: "refund_records"
CREATE UNIQUE INDEX "refundrecord_idempotency" ON "refund_records" ("created_by_account_id", "idempotency_key") WHERE (idempotency_key IS NOT NULL);
-- create index "refundrecord_order_group_id_id" to table: "refund_records"
CREATE INDEX "refundrecord_order_group_id_id" ON "refund_records" ("order_group_id", "id");
-- create index "refundrecord_source_id" to table: "refund_records"
CREATE INDEX "refundrecord_source_id" ON "refund_records" ("source", "id" DESC);
