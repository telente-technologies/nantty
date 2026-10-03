-- reverse: create index "savedcardsetup_user_id_created_at" to table: "saved_card_setups"
DROP INDEX "savedcardsetup_user_id_created_at";
-- reverse: create index "savedcardsetup_reference" to table: "saved_card_setups"
DROP INDEX "savedcardsetup_reference";
-- reverse: create index "savedcardsetup_provider_customer_id_status" to table: "saved_card_setups"
DROP INDEX "savedcardsetup_provider_customer_id_status";
-- reverse: create "saved_card_setups" table
DROP TABLE "saved_card_setups";
-- reverse: create index "providercustomer_user_id_provider" to table: "provider_customers"
DROP INDEX "providercustomer_user_id_provider";
-- reverse: create index "providercustomer_provider_provider_customer_id" to table: "provider_customers"
DROP INDEX "providercustomer_provider_provider_customer_id";
-- reverse: create "provider_customers" table
DROP TABLE "provider_customers";
-- reverse: create index "payoutonboarding_user_id" to table: "payout_onboardings"
DROP INDEX "payoutonboarding_user_id";
-- reverse: create "payout_onboardings" table
DROP TABLE "payout_onboardings";
-- reverse: create index "connectedaccountjob_user_id_step_version" to table: "connected_account_jobs"
DROP INDEX "connectedaccountjob_user_id_step_version";
-- reverse: create index "connectedaccountjob_status_updated_at" to table: "connected_account_jobs"
DROP INDEX "connectedaccountjob_status_updated_at";
-- reverse: create index "connectedaccountjob_idempotency_key" to table: "connected_account_jobs"
DROP INDEX "connectedaccountjob_idempotency_key";
-- reverse: create index "connected_account_jobs_due" to table: "connected_account_jobs"
DROP INDEX "connected_account_jobs_due";
-- reverse: create "connected_account_jobs" table
DROP TABLE "connected_account_jobs";
-- reverse: modify "payment_refunds" table
ALTER TABLE "payment_refunds" DROP COLUMN "payout_reference", DROP COLUMN "refund_method";
-- reverse: create index "connectedaccount_status_updated_at" to table: "connected_accounts"
DROP INDEX "connectedaccount_status_updated_at";
-- reverse: create index "connectedaccount_provider_account_id" to table: "connected_accounts"
DROP INDEX "connectedaccount_provider_account_id";
-- reverse: modify "connected_accounts" table
ALTER TABLE "connected_accounts" DROP COLUMN "roles", DROP COLUMN "verification_nudged_at", DROP COLUMN "verification_status_changed_at", DROP COLUMN "verification_reasons", DROP COLUMN "verification_status", DROP COLUMN "last_error", DROP COLUMN "status", ALTER COLUMN "provider_account_id" DROP DEFAULT;
-- reverse: drop index "connectedaccount_provider_account_id" from table: "connected_accounts"
CREATE UNIQUE INDEX "connectedaccount_provider_account_id" ON "connected_accounts" ("provider_account_id");
