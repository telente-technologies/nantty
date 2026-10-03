-- modify "billing_subscriptions" table
ALTER TABLE "billing_subscriptions" ADD COLUMN "provider_customer_id" character varying NOT NULL DEFAULT '', ADD COLUMN "email_token" character varying NOT NULL DEFAULT '';
-- create index "billingsubscription_provider_customer_id_provider_product_id" to table: "billing_subscriptions"
CREATE INDEX "billingsubscription_provider_customer_id_provider_product_id" ON "billing_subscriptions" ("provider_customer_id", "provider_product_id");
-- modify "connected_accounts" table
ALTER TABLE "connected_accounts" ADD COLUMN "recipient_code" character varying NOT NULL DEFAULT '', ADD COLUMN "settlement_subaccount_code" character varying NOT NULL DEFAULT '', ADD COLUMN "escrow_subaccount_code" character varying NOT NULL DEFAULT '', ADD COLUMN "bank_code" character varying NOT NULL DEFAULT '', ADD COLUMN "account_last4" character varying NOT NULL DEFAULT '', ADD COLUMN "account_name" character varying NOT NULL DEFAULT '';
-- modify "saved_card_setups" table
ALTER TABLE "saved_card_setups" ALTER COLUMN "provider_customer_id" SET DEFAULT '', ADD COLUMN "purpose" character varying NOT NULL DEFAULT 'device', ADD COLUMN "subject_id" character varying NOT NULL DEFAULT '';
