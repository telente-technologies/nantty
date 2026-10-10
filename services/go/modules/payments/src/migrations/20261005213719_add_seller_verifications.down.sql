-- reverse: create index "sellerverification_account_id" to table: "seller_verifications"
DROP INDEX "sellerverification_account_id";
-- reverse: create "seller_verifications" table
DROP TABLE "seller_verifications";
-- reverse: create index "orderpayable_seller_user_id_currency_created_at" to table: "order_payables"
DROP INDEX "orderpayable_seller_user_id_currency_created_at";
