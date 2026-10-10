-- create index "orderpayable_seller_user_id_currency_created_at" to table: "order_payables"
CREATE INDEX "orderpayable_seller_user_id_currency_created_at" ON "order_payables" ("seller_user_id", "currency", "created_at");
-- create "seller_verifications" table
CREATE TABLE "seller_verifications" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "account_id" character varying NOT NULL, "source" character varying NOT NULL, "event_id" character varying NOT NULL DEFAULT '', "verified_at" timestamptz NOT NULL, PRIMARY KEY ("id"));
-- create index "sellerverification_account_id" to table: "seller_verifications"
CREATE UNIQUE INDEX "sellerverification_account_id" ON "seller_verifications" ("account_id");
