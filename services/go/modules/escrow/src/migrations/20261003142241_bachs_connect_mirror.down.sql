-- reverse: create index "escrow_seller_user_id_status_id" to table: "escrows"
DROP INDEX "escrow_seller_user_id_status_id";
-- reverse: create index "escrow_payment_intent_id" to table: "escrows"
DROP INDEX "escrow_payment_intent_id";
-- reverse: modify "escrows" table
ALTER TABLE "escrows" DROP COLUMN "processing_fee_minor", DROP CONSTRAINT "escrows_split_and_fees_sum_to_amount", ADD CONSTRAINT "escrows_split_sums_to_amount" CHECK ((commission_minor >= 0) AND (seller_amount_minor >= 0) AND ((commission_minor + seller_amount_minor) = amount_minor));
-- reverse: drop index "escrow_seller_user_id_status" from table: "escrows"
CREATE INDEX "escrow_seller_user_id_status" ON "escrows" ("seller_user_id", "status");
