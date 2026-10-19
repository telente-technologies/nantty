-- reverse: create index "adcreditlot_user_id_created_at" to table: "ad_credit_lots"
DROP INDEX "adcreditlot_user_id_created_at";
-- reverse: create index "adcreditlot_status_expires_at" to table: "ad_credit_lots"
DROP INDEX "adcreditlot_status_expires_at";
-- reverse: create index "adcreditlot_reference" to table: "ad_credit_lots"
DROP INDEX "adcreditlot_reference";
-- reverse: create index "adcreditlot_boost_id" to table: "ad_credit_lots"
DROP INDEX "adcreditlot_boost_id";
-- reverse: create index "adcreditlot_account_id_status_expires_at" to table: "ad_credit_lots"
DROP INDEX "adcreditlot_account_id_status_expires_at";
-- reverse: create "ad_credit_lots" table
DROP TABLE "ad_credit_lots";
-- reverse: create index "adcashbacksetting_user_id" to table: "ad_cashback_settings"
DROP INDEX "adcashbacksetting_user_id";
-- reverse: create index "adcashbacksetting_enabled_updated_at" to table: "ad_cashback_settings"
DROP INDEX "adcashbacksetting_enabled_updated_at";
-- reverse: create "ad_cashback_settings" table
DROP TABLE "ad_cashback_settings";
-- reverse: create index "adboostchange_user_id_idempotency_key" to table: "ad_boost_changes"
DROP INDEX "adboostchange_user_id_idempotency_key";
-- reverse: create index "adboostchange_payment_top_up_id" to table: "ad_boost_changes"
DROP INDEX "adboostchange_payment_top_up_id";
-- reverse: create index "adboostchange_boost_id" to table: "ad_boost_changes"
DROP INDEX "adboostchange_boost_id";
-- reverse: create "ad_boost_changes" table
DROP TABLE "ad_boost_changes";
-- reverse: create index "adbalancewithdrawal_user_id_idempotency_key" to table: "ad_balance_withdrawals"
DROP INDEX "adbalancewithdrawal_user_id_idempotency_key";
-- reverse: create index "adbalancewithdrawal_status_created_at" to table: "ad_balance_withdrawals"
DROP INDEX "adbalancewithdrawal_status_created_at";
-- reverse: create index "adbalancewithdrawal_account_id_created_at" to table: "ad_balance_withdrawals"
DROP INDEX "adbalancewithdrawal_account_id_created_at";
-- reverse: create "ad_balance_withdrawals" table
DROP TABLE "ad_balance_withdrawals";
-- reverse: modify "ad_spend_batches" table
ALTER TABLE "ad_spend_batches" DROP COLUMN "refunded_minor", DROP COLUMN "cashback_minor", DROP COLUMN "credit_used_minor";
-- reverse: modify "ad_boosts" table
ALTER TABLE "ad_boosts" DROP COLUMN "scheduled_start_at", DROP COLUMN "added_budget_minor", DROP COLUMN "budget_type";
