-- reverse: create index "walletfunding_user_id_created_at" to table: "wallet_fundings"
DROP INDEX "walletfunding_user_id_created_at";
-- reverse: create index "walletfunding_status_hold_release_at" to table: "wallet_fundings"
DROP INDEX "walletfunding_status_hold_release_at";
-- reverse: create index "walletfunding_provider_provider_reference" to table: "wallet_fundings"
DROP INDEX "walletfunding_provider_provider_reference";
-- reverse: create "wallet_fundings" table
DROP TABLE "wallet_fundings";
-- reverse: create index "reconciliationrun_provider_kind_created_at" to table: "reconciliation_runs"
DROP INDEX "reconciliationrun_provider_kind_created_at";
-- reverse: create "reconciliation_runs" table
DROP TABLE "reconciliation_runs";
-- reverse: create index "reconciliationcase_status_created_at" to table: "reconciliation_cases"
DROP INDEX "reconciliationcase_status_created_at";
-- reverse: create index "reconciliationcase_dedupe_key" to table: "reconciliation_cases"
DROP INDEX "reconciliationcase_dedupe_key";
-- reverse: create "reconciliation_cases" table
DROP TABLE "reconciliation_cases";
-- reverse: create index "providerwalletnumber_wallet_id" to table: "provider_wallet_numbers"
DROP INDEX "providerwalletnumber_wallet_id";
-- reverse: create index "providerwalletnumber_provider_account_number" to table: "provider_wallet_numbers"
DROP INDEX "providerwalletnumber_provider_account_number";
-- reverse: create "provider_wallet_numbers" table
DROP TABLE "provider_wallet_numbers";
-- reverse: create index "providerwallet_status" to table: "provider_wallets"
DROP INDEX "providerwallet_status";
-- reverse: create index "providerwallet_provider_user_id_currency" to table: "provider_wallets"
DROP INDEX "providerwallet_provider_user_id_currency";
-- reverse: create index "providerwallet_provider_barter_id" to table: "provider_wallets"
DROP INDEX "providerwallet_provider_barter_id";
-- reverse: create index "providerwallet_provider_account_ref" to table: "provider_wallets"
DROP INDEX "providerwallet_provider_account_ref";
-- reverse: create "provider_wallets" table
DROP TABLE "provider_wallets";
-- reverse: create index "providermovement_status_created_at" to table: "provider_movements"
DROP INDEX "providermovement_status_created_at";
-- reverse: create index "providermovement_reference" to table: "provider_movements"
DROP INDEX "providermovement_reference";
-- reverse: create index "providermovement_kind_subject_id" to table: "provider_movements"
DROP INDEX "providermovement_kind_subject_id";
-- reverse: create index "providermovement_from_wallet_ref_status" to table: "provider_movements"
DROP INDEX "providermovement_from_wallet_ref_status";
-- reverse: create "provider_movements" table
DROP TABLE "provider_movements";
-- reverse: modify "payout_transfers" table
ALTER TABLE "payout_transfers" DROP COLUMN "sealed_destination", DROP COLUMN "source_wallet_ref";
-- reverse: create index "payment_intents_provider_charge_unique" to table: "payment_intents"
DROP INDEX "payment_intents_provider_charge_unique";
-- reverse: modify "payment_intents" table
ALTER TABLE "payment_intents" DROP COLUMN "provider_settled_at", DROP COLUMN "customer_email";
-- reverse: modify "billing_authorizations" table
ALTER TABLE "billing_authorizations" DROP COLUMN "token_email";
