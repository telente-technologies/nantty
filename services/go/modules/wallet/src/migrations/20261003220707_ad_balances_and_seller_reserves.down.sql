-- reverse: create index "seller_reserve_flags_active" to table: "seller_reserve_flags"
DROP INDEX "seller_reserve_flags_active";
-- reverse: create "seller_reserve_flags" table
DROP TABLE "seller_reserve_flags";
-- reverse: create index "adspenddebit_idempotency_key" to table: "ad_spend_debits"
DROP INDEX "adspenddebit_idempotency_key";
-- reverse: create index "adspenddebit_ad_account_id_created_at" to table: "ad_spend_debits"
DROP INDEX "adspenddebit_ad_account_id_created_at";
-- reverse: create "ad_spend_debits" table
DROP TABLE "ad_spend_debits";
-- reverse: create index "adbalancetopup_reference" to table: "ad_balance_top_ups"
DROP INDEX "adbalancetopup_reference";
-- reverse: create index "adbalancetopup_funded_by_user_id_created_at" to table: "ad_balance_top_ups"
DROP INDEX "adbalancetopup_funded_by_user_id_created_at";
-- reverse: create index "adbalancetopup_ad_account_id_status_created_at" to table: "ad_balance_top_ups"
DROP INDEX "adbalancetopup_ad_account_id_status_created_at";
-- reverse: create "ad_balance_top_ups" table
DROP TABLE "ad_balance_top_ups";
