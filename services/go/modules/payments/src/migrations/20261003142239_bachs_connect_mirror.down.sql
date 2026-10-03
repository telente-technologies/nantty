-- reverse: create index "providerpayoutdestination_conn_906067a0d7662452591395ddf16e99a7" to table: "provider_payout_destinations"
DROP INDEX "providerpayoutdestination_conn_906067a0d7662452591395ddf16e99a7";
-- reverse: create "provider_payout_destinations" table
DROP TABLE "provider_payout_destinations";
-- reverse: create index "providerdispute_status" to table: "provider_disputes"
DROP INDEX "providerdispute_status";
-- reverse: create index "providerdispute_provider_provider_dispute_id" to table: "provider_disputes"
DROP INDEX "providerdispute_provider_provider_dispute_id";
-- reverse: create "provider_disputes" table
DROP TABLE "provider_disputes";
-- reverse: create index "connectedaccount_user_id_provider" to table: "connected_accounts"
DROP INDEX "connectedaccount_user_id_provider";
-- reverse: create index "connectedaccount_provider_account_id" to table: "connected_accounts"
DROP INDEX "connectedaccount_provider_account_id";
-- reverse: create "connected_accounts" table
DROP TABLE "connected_accounts";
-- reverse: create index "billingsubscription_reference" to table: "billing_subscriptions"
DROP INDEX "billingsubscription_reference";
-- reverse: create index "billingsubscription_provider_subscription_id" to table: "billing_subscriptions"
DROP INDEX "billingsubscription_provider_subscription_id";
-- reverse: create index "billingsubscription_owner_user_id_plan_code" to table: "billing_subscriptions"
DROP INDEX "billingsubscription_owner_user_id_plan_code";
-- reverse: create "billing_subscriptions" table
DROP TABLE "billing_subscriptions";
-- reverse: create index "payouttransfer_provider_transfer_code" to table: "payout_transfers"
DROP INDEX "payouttransfer_provider_transfer_code";
-- reverse: create index "payouttransfer_connected_account_id_status" to table: "payout_transfers"
DROP INDEX "payouttransfer_connected_account_id_status";
-- reverse: modify "payout_transfers" table
ALTER TABLE "payout_transfers" DROP COLUMN "fee_minor", DROP COLUMN "provider_destination_id", DROP COLUMN "transfer_group", DROP COLUMN "beneficiary_user_id", DROP COLUMN "connected_account_id", DROP COLUMN "kind", ALTER COLUMN "destination_last4" DROP DEFAULT, ALTER COLUMN "bank_code" DROP DEFAULT, DROP CONSTRAINT "payout_transfers_fee_not_negative";
-- reverse: create index "paymentrefund_provider_refund_id" to table: "payment_refunds"
DROP INDEX "paymentrefund_provider_refund_id";
-- reverse: modify "payment_refunds" table
ALTER TABLE "payment_refunds" DROP COLUMN "fee_top_up_transfer_id", DROP COLUMN "fee_top_up_minor", DROP COLUMN "full_refund", DROP COLUMN "beneficiary_user_id", DROP COLUMN "connected_account_id", DROP CONSTRAINT "payment_refunds_fee_top_up_not_negative";
-- reverse: create index "paymentintent_provider_transaction_id" to table: "payment_intents"
DROP INDEX "paymentintent_provider_transaction_id";
-- reverse: create index "paymentintent_provider_checkout_id" to table: "payment_intents"
DROP INDEX "paymentintent_provider_checkout_id";
-- reverse: modify "payment_intents" table
ALTER TABLE "payment_intents" DROP COLUMN "provider_checkout_id", DROP COLUMN "platform_fee_minor", DROP COLUMN "beneficiary_user_id", DROP COLUMN "connected_account_id", DROP CONSTRAINT "payment_intents_platform_fee_in_range";
