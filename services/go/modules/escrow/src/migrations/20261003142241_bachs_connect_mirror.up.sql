-- drop index "escrow_seller_user_id_status" from table: "escrows"
DROP INDEX "escrow_seller_user_id_status";
-- modify "escrows" table
ALTER TABLE "escrows" DROP CONSTRAINT "escrows_split_sums_to_amount", ADD CONSTRAINT "escrows_split_and_fees_sum_to_amount" CHECK ((commission_minor >= 0) AND (seller_amount_minor >= 0) AND (processing_fee_minor >= 0) AND (((commission_minor + seller_amount_minor) + processing_fee_minor) = amount_minor)), ADD COLUMN "processing_fee_minor" bigint NOT NULL DEFAULT 0;
-- create index "escrow_payment_intent_id" to table: "escrows"
CREATE INDEX "escrow_payment_intent_id" ON "escrows" ("payment_intent_id");
-- create index "escrow_seller_user_id_status_id" to table: "escrows"
CREATE INDEX "escrow_seller_user_id_status_id" ON "escrows" ("seller_user_id", "status", "id" DESC);
