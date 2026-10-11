-- modify "billing_authorizations" table
ALTER TABLE "billing_authorizations" ADD COLUMN "token_email" character varying NOT NULL DEFAULT '';
-- modify "payment_intents" table
ALTER TABLE "payment_intents" ADD COLUMN "customer_email" character varying NOT NULL DEFAULT '', ADD COLUMN "provider_settled_at" timestamptz NULL;
-- dedupe before the unique index: keep the succeeded (else the earliest) intent per provider charge id; the others keep the id as evidence with a ":dup:" suffix and are flagged
UPDATE "payment_intents" AS "intent"
SET "provider_transaction_id" = left("intent"."provider_transaction_id", 70) || ':dup:' || "intent"."id"::text,
    "failure_reason" = left('chargeReused: ' || "intent"."failure_reason", 300)
FROM (
  SELECT "id", row_number() OVER (PARTITION BY "provider", "provider_transaction_id" ORDER BY ("status" = 'succeeded') DESC, "created_at", "id") AS "rank"
  FROM "payment_intents" WHERE "provider_transaction_id" <> ''
) AS "ranked"
WHERE "intent"."id" = "ranked"."id" AND "ranked"."rank" > 1;
-- create index "payment_intents_provider_charge_unique" to table: "payment_intents"
-- atlas:nolint MF101 duplicates are renamed by the UPDATE above
CREATE UNIQUE INDEX "payment_intents_provider_charge_unique" ON "payment_intents" ("provider", "provider_transaction_id") WHERE ((provider_transaction_id)::text <> ''::text);
-- modify "payout_transfers" table
ALTER TABLE "payout_transfers" ADD COLUMN "source_wallet_ref" character varying NOT NULL DEFAULT '', ADD COLUMN "sealed_destination" bytea NULL;
-- create "provider_movements" table
CREATE TABLE "provider_movements" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "reference" character varying NOT NULL, "provider" character varying NOT NULL, "kind" character varying NOT NULL, "subject_id" character varying NOT NULL DEFAULT '', "user_id" character varying NOT NULL DEFAULT '', "from_wallet_ref" character varying NOT NULL DEFAULT '', "from_user_id" character varying NOT NULL DEFAULT '', "to_barter_id" character varying NOT NULL DEFAULT '', "to_wallet_ref" character varying NOT NULL DEFAULT '', "to_platform" boolean NOT NULL DEFAULT false, "to_user_id" character varying NOT NULL DEFAULT '', "amount_minor" bigint NOT NULL, "currency" character varying NOT NULL, "status" character varying NOT NULL DEFAULT 'pending', "provider_transfer_id" character varying NOT NULL DEFAULT '', "attempts" bigint NOT NULL DEFAULT 0, "failure_reason" character varying NOT NULL DEFAULT '', "blocked_on" character varying NOT NULL DEFAULT '', "not_before" timestamptz NULL, "sent_at" timestamptz NULL, "finished_at" timestamptz NULL, "metadata" jsonb NOT NULL, "version" bigint NOT NULL DEFAULT 0, "updated_at" timestamptz NOT NULL, PRIMARY KEY ("id"), CONSTRAINT "provider_movements_amount_positive" CHECK (amount_minor > 0), CONSTRAINT "provider_movements_one_side_is_a_wallet" CHECK (((from_wallet_ref)::text <> ''::text) OR ((to_user_id)::text <> ''::text)));
-- create index "providermovement_from_wallet_ref_status" to table: "provider_movements"
CREATE INDEX "providermovement_from_wallet_ref_status" ON "provider_movements" ("from_wallet_ref", "status");
-- create index "providermovement_kind_subject_id" to table: "provider_movements"
CREATE INDEX "providermovement_kind_subject_id" ON "provider_movements" ("kind", "subject_id");
-- create index "providermovement_reference" to table: "provider_movements"
CREATE UNIQUE INDEX "providermovement_reference" ON "provider_movements" ("reference");
-- create index "providermovement_status_created_at" to table: "provider_movements"
CREATE INDEX "providermovement_status_created_at" ON "provider_movements" ("status", "created_at");
-- create "provider_wallets" table
CREATE TABLE "provider_wallets" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "user_id" character varying NOT NULL, "provider" character varying NOT NULL, "currency" character varying NOT NULL, "account_ref" character varying NOT NULL, "barter_id" character varying NOT NULL, "nuban" character varying NOT NULL DEFAULT '', "bank_code" character varying NOT NULL DEFAULT '', "bank_name" character varying NOT NULL DEFAULT '', "account_name" character varying NOT NULL DEFAULT '', "alias_email" character varying NOT NULL DEFAULT '', "status" character varying NOT NULL DEFAULT 'active', "freeze_reason" character varying NOT NULL DEFAULT '', "frozen_at" timestamptz NULL, "first_funded_at" timestamptz NULL, "version" bigint NOT NULL DEFAULT 0, "updated_at" timestamptz NOT NULL, PRIMARY KEY ("id"));
-- create index "providerwallet_provider_account_ref" to table: "provider_wallets"
CREATE UNIQUE INDEX "providerwallet_provider_account_ref" ON "provider_wallets" ("provider", "account_ref");
-- create index "providerwallet_provider_barter_id" to table: "provider_wallets"
CREATE UNIQUE INDEX "providerwallet_provider_barter_id" ON "provider_wallets" ("provider", "barter_id");
-- create index "providerwallet_provider_user_id_currency" to table: "provider_wallets"
CREATE UNIQUE INDEX "providerwallet_provider_user_id_currency" ON "provider_wallets" ("provider", "user_id", "currency");
-- create index "providerwallet_status" to table: "provider_wallets"
CREATE INDEX "providerwallet_status" ON "provider_wallets" ("status");
-- create "provider_wallet_numbers" table
CREATE TABLE "provider_wallet_numbers" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "wallet_id" uuid NOT NULL, "provider" character varying NOT NULL, "account_number" character varying NOT NULL, "bank_code" character varying NOT NULL DEFAULT '', "bank_name" character varying NOT NULL DEFAULT '', PRIMARY KEY ("id"));
-- create index "providerwalletnumber_provider_account_number" to table: "provider_wallet_numbers"
CREATE UNIQUE INDEX "providerwalletnumber_provider_account_number" ON "provider_wallet_numbers" ("provider", "account_number");
-- create index "providerwalletnumber_wallet_id" to table: "provider_wallet_numbers"
CREATE INDEX "providerwalletnumber_wallet_id" ON "provider_wallet_numbers" ("wallet_id");
-- create "reconciliation_cases" table
CREATE TABLE "reconciliation_cases" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "provider" character varying NOT NULL, "kind" character varying NOT NULL, "subject" character varying NOT NULL, "dedupe_key" character varying NOT NULL, "expected_minor" bigint NOT NULL DEFAULT 0, "actual_minor" bigint NOT NULL DEFAULT 0, "currency" character varying NOT NULL DEFAULT '', "detail" character varying NOT NULL DEFAULT '', "status" character varying NOT NULL DEFAULT 'open', "resolved_at" timestamptz NULL, PRIMARY KEY ("id"));
-- create index "reconciliationcase_dedupe_key" to table: "reconciliation_cases"
CREATE UNIQUE INDEX "reconciliationcase_dedupe_key" ON "reconciliation_cases" ("dedupe_key");
-- create index "reconciliationcase_status_created_at" to table: "reconciliation_cases"
CREATE INDEX "reconciliationcase_status_created_at" ON "reconciliation_cases" ("status", "created_at");
-- create "reconciliation_runs" table
CREATE TABLE "reconciliation_runs" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "provider" character varying NOT NULL, "kind" character varying NOT NULL, "status" character varying NOT NULL DEFAULT 'running', "wallets_checked" bigint NOT NULL DEFAULT 0, "issues_found" bigint NOT NULL DEFAULT 0, "summary" jsonb NOT NULL, "finished_at" timestamptz NULL, PRIMARY KEY ("id"));
-- create index "reconciliationrun_provider_kind_created_at" to table: "reconciliation_runs"
CREATE INDEX "reconciliationrun_provider_kind_created_at" ON "reconciliation_runs" ("provider", "kind", "created_at");
-- create "wallet_fundings" table
CREATE TABLE "wallet_fundings" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "wallet_id" uuid NOT NULL, "user_id" character varying NOT NULL, "provider" character varying NOT NULL, "provider_reference" character varying NOT NULL, "source" character varying NOT NULL DEFAULT 'deposit', "account_number" character varying NOT NULL DEFAULT '', "gross_minor" bigint NOT NULL, "provider_fee_minor" bigint NOT NULL DEFAULT 0, "deposit_fee_minor" bigint NOT NULL DEFAULT 0, "hinted_minor" bigint NOT NULL DEFAULT 0, "currency" character varying NOT NULL, "status" character varying NOT NULL DEFAULT 'held', "hold_release_at" timestamptz NOT NULL, "hold_released_at" timestamptz NULL, "sweep_reference" character varying NOT NULL DEFAULT '', "reversal_reference" character varying NOT NULL DEFAULT '', "reversed_at" timestamptz NULL, "debt_minor" bigint NOT NULL DEFAULT 0, "version" bigint NOT NULL DEFAULT 0, PRIMARY KEY ("id"), CONSTRAINT "wallet_fundings_amounts_valid" CHECK ((gross_minor > 0) AND (provider_fee_minor >= 0) AND (deposit_fee_minor >= 0) AND ((provider_fee_minor + deposit_fee_minor) <= gross_minor)), CONSTRAINT "wallet_fundings_debt_valid" CHECK (debt_minor >= 0));
-- create index "walletfunding_provider_provider_reference" to table: "wallet_fundings"
CREATE UNIQUE INDEX "walletfunding_provider_provider_reference" ON "wallet_fundings" ("provider", "provider_reference");
-- create index "walletfunding_status_hold_release_at" to table: "wallet_fundings"
CREATE INDEX "walletfunding_status_hold_release_at" ON "wallet_fundings" ("status", "hold_release_at");
-- create index "walletfunding_user_id_created_at" to table: "wallet_fundings"
CREATE INDEX "walletfunding_user_id_created_at" ON "wallet_fundings" ("user_id", "created_at");
