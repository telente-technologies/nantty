-- reverse: create index "refundrecord_source_id" to table: "refund_records"
DROP INDEX "refundrecord_source_id";
-- reverse: create index "refundrecord_order_group_id_id" to table: "refund_records"
DROP INDEX "refundrecord_order_group_id_id";
-- reverse: create index "refundrecord_idempotency" to table: "refund_records"
DROP INDEX "refundrecord_idempotency";
-- reverse: create "refund_records" table
DROP TABLE "refund_records";
-- reverse: modify "order_items" table
ALTER TABLE "order_items" DROP COLUMN "attribution_id", DROP COLUMN "attribution_source", DROP COLUMN "taxable";
-- reverse: modify "cart_items" table
ALTER TABLE "cart_items" DROP COLUMN "attribution_id", DROP COLUMN "attribution_source";
