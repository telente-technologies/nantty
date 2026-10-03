-- modify "payment_intents" table
ALTER TABLE "payment_intents" ADD CONSTRAINT "payment_intents_platform_fee_in_range" CHECK ((platform_fee_minor >= 0) AND (platform_fee_minor < amount_minor)), ADD COLUMN "connected_account_id" character varying NOT NULL DEFAULT '', ADD COLUMN "beneficiary_user_id" character varying NOT NULL DEFAULT '', ADD COLUMN "platform_fee_minor" bigint NOT NULL DEFAULT 0, ADD COLUMN "provider_checkout_id" character varying NOT NULL DEFAULT '';
-- create index "paymentintent_provider_checkout_id" to table: "payment_intents"
CREATE INDEX "paymentintent_provider_checkout_id" ON "payment_intents" ("provider_checkout_id");
-- create index "paymentintent_provider_transaction_id" to table: "payment_intents"
CREATE INDEX "paymentintent_provider_transaction_id" ON "payment_intents" ("provider_transaction_id");
-- modify "payment_refunds" table
ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_fee_top_up_not_negative" CHECK (fee_top_up_minor >= 0), ADD COLUMN "connected_account_id" character varying NOT NULL DEFAULT '', ADD COLUMN "beneficiary_user_id" character varying NOT NULL DEFAULT '', ADD COLUMN "full_refund" boolean NOT NULL DEFAULT false, ADD COLUMN "fee_top_up_minor" bigint NOT NULL DEFAULT 0, ADD COLUMN "fee_top_up_transfer_id" character varying NOT NULL DEFAULT '';
-- create index "paymentrefund_provider_refund_id" to table: "payment_refunds"
CREATE INDEX "paymentrefund_provider_refund_id" ON "payment_refunds" ("provider_refund_id");
-- modify "payout_transfers" table
ALTER TABLE "payout_transfers" ADD CONSTRAINT "payout_transfers_fee_not_negative" CHECK (fee_minor >= 0), ALTER COLUMN "bank_code" SET DEFAULT '', ALTER COLUMN "destination_last4" SET DEFAULT '', ADD COLUMN "kind" character varying NOT NULL DEFAULT 'payout', ADD COLUMN "connected_account_id" character varying NOT NULL DEFAULT '', ADD COLUMN "beneficiary_user_id" character varying NOT NULL DEFAULT '', ADD COLUMN "transfer_group" character varying NOT NULL DEFAULT '', ADD COLUMN "provider_destination_id" character varying NOT NULL DEFAULT '', ADD COLUMN "fee_minor" bigint NOT NULL DEFAULT 0;
-- create index "payouttransfer_connected_account_id_status" to table: "payout_transfers"
CREATE INDEX "payouttransfer_connected_account_id_status" ON "payout_transfers" ("connected_account_id", "status");
-- create index "payouttransfer_provider_transfer_code" to table: "payout_transfers"
CREATE INDEX "payouttransfer_provider_transfer_code" ON "payout_transfers" ("provider_transfer_code");
-- create "billing_subscriptions" table
CREATE TABLE "billing_subscriptions" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "owner_user_id" character varying NOT NULL, "plan_code" character varying NOT NULL, "provider" character varying NOT NULL, "reference" character varying NOT NULL, "provider_product_id" character varying NOT NULL, "provider_checkout_id" character varying NOT NULL DEFAULT '', "provider_subscription_id" character varying NOT NULL DEFAULT '', "status" character varying NOT NULL DEFAULT 'pending_checkout', "trial_ends_at" timestamptz NULL, "current_period_ends_at" timestamptz NULL, "downgraded_at" timestamptz NULL, "updated_at" timestamptz NOT NULL, PRIMARY KEY ("id"));
-- create index "billingsubscription_owner_user_id_plan_code" to table: "billing_subscriptions"
CREATE INDEX "billingsubscription_owner_user_id_plan_code" ON "billing_subscriptions" ("owner_user_id", "plan_code");
-- create index "billingsubscription_provider_subscription_id" to table: "billing_subscriptions"
CREATE INDEX "billingsubscription_provider_subscription_id" ON "billing_subscriptions" ("provider_subscription_id");
-- create index "billingsubscription_reference" to table: "billing_subscriptions"
CREATE UNIQUE INDEX "billingsubscription_reference" ON "billing_subscriptions" ("reference");
-- create "connected_accounts" table
CREATE TABLE "connected_accounts" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "user_id" character varying NOT NULL, "provider" character varying NOT NULL, "provider_account_id" character varying NOT NULL, "accepts_payments" boolean NOT NULL DEFAULT false, "capability_statuses" jsonb NOT NULL, "outstanding_requirements" jsonb NOT NULL, "requirements_deadline_at" timestamptz NULL, "manual_payout_schedule_confirmed" boolean NOT NULL DEFAULT false, "payouts_frozen" boolean NOT NULL DEFAULT false, "payouts_frozen_reason" character varying NOT NULL DEFAULT '', "virtual_account_number" character varying NOT NULL DEFAULT '', "virtual_account_bank_name" character varying NOT NULL DEFAULT '', "version" bigint NOT NULL DEFAULT 0, "updated_at" timestamptz NOT NULL, PRIMARY KEY ("id"));
-- create index "connectedaccount_provider_account_id" to table: "connected_accounts"
CREATE UNIQUE INDEX "connectedaccount_provider_account_id" ON "connected_accounts" ("provider_account_id");
-- create index "connectedaccount_user_id_provider" to table: "connected_accounts"
CREATE UNIQUE INDEX "connectedaccount_user_id_provider" ON "connected_accounts" ("user_id", "provider");
-- create "provider_disputes" table
CREATE TABLE "provider_disputes" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "provider" character varying NOT NULL, "provider_dispute_id" character varying NOT NULL, "provider_charge_id" character varying NOT NULL DEFAULT '', "connected_account_id" character varying NOT NULL DEFAULT '', "payment_intent_id" uuid NULL, "amount_minor" bigint NOT NULL DEFAULT 0, "currency" character varying NOT NULL DEFAULT '', "status" character varying NOT NULL DEFAULT '', "reason" character varying NOT NULL DEFAULT '', "response_deadline_at" timestamptz NULL, "updated_at" timestamptz NOT NULL, PRIMARY KEY ("id"));
-- create index "providerdispute_provider_provider_dispute_id" to table: "provider_disputes"
CREATE UNIQUE INDEX "providerdispute_provider_provider_dispute_id" ON "provider_disputes" ("provider", "provider_dispute_id");
-- create index "providerdispute_status" to table: "provider_disputes"
CREATE INDEX "providerdispute_status" ON "provider_disputes" ("status");
-- create "provider_payout_destinations" table
CREATE TABLE "provider_payout_destinations" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "connected_account_id" uuid NOT NULL, "account_fingerprint" character varying NOT NULL, "currency" character varying NOT NULL, "bank_code" character varying NOT NULL, "account_last4" character varying NOT NULL DEFAULT '', "provider_destination_id" character varying NOT NULL, PRIMARY KEY ("id"));
-- create index "providerpayoutdestination_conn_906067a0d7662452591395ddf16e99a7" to table: "provider_payout_destinations"
CREATE UNIQUE INDEX "providerpayoutdestination_conn_906067a0d7662452591395ddf16e99a7" ON "provider_payout_destinations" ("connected_account_id", "account_fingerprint", "currency");
