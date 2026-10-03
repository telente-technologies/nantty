-- drop index "connectedaccount_provider_account_id" from table: "connected_accounts"
DROP INDEX "connectedaccount_provider_account_id";
-- modify "connected_accounts" table
ALTER TABLE "connected_accounts" ALTER COLUMN "provider_account_id" SET DEFAULT '', ADD COLUMN "status" character varying NOT NULL DEFAULT 'created', ADD COLUMN "last_error" character varying NOT NULL DEFAULT '', ADD COLUMN "verification_status" character varying NOT NULL DEFAULT 'not_started', ADD COLUMN "verification_reasons" jsonb NULL, ADD COLUMN "verification_status_changed_at" timestamptz NULL, ADD COLUMN "verification_nudged_at" timestamptz NULL, ADD COLUMN "roles" jsonb NULL;
-- create index "connectedaccount_provider_account_id" to table: "connected_accounts"
CREATE UNIQUE INDEX "connectedaccount_provider_account_id" ON "connected_accounts" ("provider_account_id") WHERE ((provider_account_id)::text <> ''::text);
-- create index "connectedaccount_status_updated_at" to table: "connected_accounts"
CREATE INDEX "connectedaccount_status_updated_at" ON "connected_accounts" ("status", "updated_at");
-- modify "payment_refunds" table
ALTER TABLE "payment_refunds" ADD COLUMN "refund_method" character varying NOT NULL DEFAULT 'provider_refund', ADD COLUMN "payout_reference" character varying NOT NULL DEFAULT '';
-- create "connected_account_jobs" table
CREATE TABLE "connected_account_jobs" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "user_id" character varying NOT NULL, "step" character varying NOT NULL, "version" bigint NOT NULL, "idempotency_key" character varying NOT NULL, "status" character varying NOT NULL DEFAULT 'queued', "attempt_count" bigint NOT NULL DEFAULT 0, "next_attempt_at" timestamptz NOT NULL, "last_attempt_at" timestamptz NULL, "last_error" character varying NOT NULL DEFAULT '', "sealed_payload" bytea NULL, "sealed_result" bytea NULL, "completed_at" timestamptz NULL, "updated_at" timestamptz NOT NULL, PRIMARY KEY ("id"));
-- create index "connected_account_jobs_due" to table: "connected_account_jobs"
CREATE INDEX "connected_account_jobs_due" ON "connected_account_jobs" ("next_attempt_at") WHERE ((status)::text = 'queued'::text);
-- create index "connectedaccountjob_idempotency_key" to table: "connected_account_jobs"
CREATE UNIQUE INDEX "connectedaccountjob_idempotency_key" ON "connected_account_jobs" ("idempotency_key");
-- create index "connectedaccountjob_status_updated_at" to table: "connected_account_jobs"
CREATE INDEX "connectedaccountjob_status_updated_at" ON "connected_account_jobs" ("status", "updated_at");
-- create index "connectedaccountjob_user_id_step_version" to table: "connected_account_jobs"
CREATE UNIQUE INDEX "connectedaccountjob_user_id_step_version" ON "connected_account_jobs" ("user_id", "step", "version");
-- create "payout_onboardings" table
CREATE TABLE "payout_onboardings" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "user_id" character varying NOT NULL, "role" character varying NOT NULL DEFAULT 'creator', "legal_name" character varying NOT NULL DEFAULT '', "sealed_identity" bytea NULL, "id_type" character varying NOT NULL DEFAULT '', "id_last4" character varying NOT NULL DEFAULT '', "registered_business" boolean NOT NULL DEFAULT false, "cac_number" character varying NOT NULL DEFAULT '', "business_type" character varying NOT NULL DEFAULT '', "bank_code" character varying NOT NULL DEFAULT '', "bank_name" character varying NOT NULL DEFAULT '', "account_last4" character varying NOT NULL DEFAULT '', "resolved_account_name" character varying NOT NULL DEFAULT '', "completed_steps" jsonb NULL, "updated_at" timestamptz NOT NULL, PRIMARY KEY ("id"));
-- create index "payoutonboarding_user_id" to table: "payout_onboardings"
CREATE UNIQUE INDEX "payoutonboarding_user_id" ON "payout_onboardings" ("user_id");
-- create "provider_customers" table
CREATE TABLE "provider_customers" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "user_id" character varying NOT NULL, "provider" character varying NOT NULL, "provider_customer_id" character varying NOT NULL, PRIMARY KEY ("id"));
-- create index "providercustomer_provider_provider_customer_id" to table: "provider_customers"
CREATE UNIQUE INDEX "providercustomer_provider_provider_customer_id" ON "provider_customers" ("provider", "provider_customer_id");
-- create index "providercustomer_user_id_provider" to table: "provider_customers"
CREATE UNIQUE INDEX "providercustomer_user_id_provider" ON "provider_customers" ("user_id", "provider");
-- create "saved_card_setups" table
CREATE TABLE "saved_card_setups" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "reference" character varying NOT NULL, "user_id" character varying NOT NULL, "provider" character varying NOT NULL, "provider_customer_id" character varying NOT NULL, "provider_checkout_id" character varying NOT NULL DEFAULT '', "status" character varying NOT NULL DEFAULT 'pending', "card_brand" character varying NOT NULL DEFAULT '', "card_last4" character varying NOT NULL DEFAULT '', "card_expiry_month" bigint NOT NULL DEFAULT 0, "card_expiry_year" bigint NOT NULL DEFAULT 0, "card_fingerprint_hash" character varying NOT NULL DEFAULT '', "saved_at" timestamptz NULL, PRIMARY KEY ("id"));
-- create index "savedcardsetup_provider_customer_id_status" to table: "saved_card_setups"
CREATE INDEX "savedcardsetup_provider_customer_id_status" ON "saved_card_setups" ("provider_customer_id", "status");
-- create index "savedcardsetup_reference" to table: "saved_card_setups"
CREATE UNIQUE INDEX "savedcardsetup_reference" ON "saved_card_setups" ("reference");
-- create index "savedcardsetup_user_id_created_at" to table: "saved_card_setups"
CREATE INDEX "savedcardsetup_user_id_created_at" ON "saved_card_setups" ("user_id", "created_at");
