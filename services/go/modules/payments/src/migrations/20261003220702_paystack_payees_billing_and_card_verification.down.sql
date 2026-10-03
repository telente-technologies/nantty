-- reverse: modify "saved_card_setups" table
ALTER TABLE "saved_card_setups" DROP COLUMN "subject_id", DROP COLUMN "purpose", ALTER COLUMN "provider_customer_id" DROP DEFAULT;
-- reverse: modify "connected_accounts" table
ALTER TABLE "connected_accounts" DROP COLUMN "account_name", DROP COLUMN "account_last4", DROP COLUMN "bank_code", DROP COLUMN "escrow_subaccount_code", DROP COLUMN "settlement_subaccount_code", DROP COLUMN "recipient_code";
-- reverse: create index "billingsubscription_provider_customer_id_provider_product_id" to table: "billing_subscriptions"
DROP INDEX "billingsubscription_provider_customer_id_provider_product_id";
-- reverse: modify "billing_subscriptions" table
ALTER TABLE "billing_subscriptions" DROP COLUMN "email_token", DROP COLUMN "provider_customer_id";
