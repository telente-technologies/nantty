-- reverse: create index "adbalanceearningstransfer_user_id_idempotency_key" to table: "ad_balance_earnings_transfers"
DROP INDEX "adbalanceearningstransfer_user_id_idempotency_key";
-- reverse: create index "adbalanceearningstransfer_ad_account_id_user_id_created_at" to table: "ad_balance_earnings_transfers"
DROP INDEX "adbalanceearningstransfer_ad_account_id_user_id_created_at";
-- reverse: create "ad_balance_earnings_transfers" table
DROP TABLE "ad_balance_earnings_transfers";
