-- create "coin_conversions" table
CREATE TABLE "coin_conversions" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "user_id" character varying NOT NULL, "coins" bigint NOT NULL, "cash_minor" bigint NOT NULL, "currency" character varying NOT NULL, "coin_cash_value_minor" bigint NOT NULL, PRIMARY KEY ("id"), CONSTRAINT "coin_conversions_positive" CHECK ((coins > 0) AND (cash_minor > 0) AND (coin_cash_value_minor > 0)));
-- create index "coinconversion_user_id_created_at" to table: "coin_conversions"
CREATE INDEX "coinconversion_user_id_created_at" ON "coin_conversions" ("user_id", "created_at");
-- create "coin_packages" table
CREATE TABLE "coin_packages" ("id" character varying NOT NULL, "name" character varying NOT NULL, "coins" bigint NOT NULL, "bonus_coins" bigint NOT NULL DEFAULT 0, "purchase_channel" character varying NOT NULL, "prices" jsonb NOT NULL, "store_product_id" character varying NOT NULL DEFAULT '', "active" boolean NOT NULL DEFAULT true, "sort_order" bigint NOT NULL DEFAULT 0, "updated_at" timestamptz NOT NULL, PRIMARY KEY ("id"), CONSTRAINT "coin_packages_coins_positive" CHECK ((coins > 0) AND (bonus_coins >= 0)));
-- create index "coinpackage_purchase_channel_active_sort_order" to table: "coin_packages"
CREATE INDEX "coinpackage_purchase_channel_active_sort_order" ON "coin_packages" ("purchase_channel", "active", "sort_order");
-- create index "coinpackage_store_product_id" to table: "coin_packages"
CREATE INDEX "coinpackage_store_product_id" ON "coin_packages" ("store_product_id");
-- create "coin_purchases" table
CREATE TABLE "coin_purchases" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "user_id" character varying NOT NULL, "package_id" character varying NOT NULL, "coins" bigint NOT NULL, "channel" character varying NOT NULL, "source" character varying NOT NULL, "provider" character varying NOT NULL, "reference" character varying NOT NULL, "amount_minor" bigint NOT NULL, "currency" character varying NOT NULL, "store_fee_minor" bigint NOT NULL DEFAULT 0, "status" character varying NOT NULL DEFAULT 'pending', "payment_intent_id" uuid NULL, "authorization_url" character varying NOT NULL DEFAULT '', "credited_at" timestamptz NULL, "refunded_at" timestamptz NULL, "clawback_shortfall_coins" bigint NOT NULL DEFAULT 0, "updated_at" timestamptz NOT NULL, PRIMARY KEY ("id"), CONSTRAINT "coin_purchases_amounts_valid" CHECK ((coins > 0) AND (amount_minor >= 0) AND (store_fee_minor >= 0) AND (clawback_shortfall_coins >= 0)));
-- create index "coinpurchase_reference" to table: "coin_purchases"
CREATE UNIQUE INDEX "coinpurchase_reference" ON "coin_purchases" ("reference");
-- create index "coinpurchase_user_id_created_at" to table: "coin_purchases"
CREATE INDEX "coinpurchase_user_id_created_at" ON "coin_purchases" ("user_id", "created_at");
-- create "coin_transfers" table
CREATE TABLE "coin_transfers" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "sender_user_id" character varying NOT NULL, "recipient_user_id" character varying NOT NULL, "coins" bigint NOT NULL, "fee_coins" bigint NOT NULL, "net_coins" bigint NOT NULL, "fee_bps" bigint NOT NULL, "note" character varying NOT NULL DEFAULT '', PRIMARY KEY ("id"), CONSTRAINT "coin_transfers_split_sums" CHECK ((coins > 0) AND (net_coins > 0) AND (fee_coins >= 0) AND ((net_coins + fee_coins) = coins)));
-- create index "cointransfer_recipient_user_id_created_at" to table: "coin_transfers"
CREATE INDEX "cointransfer_recipient_user_id_created_at" ON "coin_transfers" ("recipient_user_id", "created_at");
-- create index "cointransfer_sender_user_id_created_at" to table: "coin_transfers"
CREATE INDEX "cointransfer_sender_user_id_created_at" ON "coin_transfers" ("sender_user_id", "created_at");
-- create "idempotent_requests" table
CREATE TABLE "idempotent_requests" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "scope" character varying NOT NULL, "key" character varying NOT NULL, "request_hash" character varying NOT NULL, "response_body" jsonb NULL, PRIMARY KEY ("id"));
-- create index "idempotentrequest_scope_key" to table: "idempotent_requests"
CREATE UNIQUE INDEX "idempotentrequest_scope_key" ON "idempotent_requests" ("scope", "key");
-- create "outbox_events" table
CREATE TABLE "outbox_events" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "event_type" character varying NOT NULL, "subject" character varying NOT NULL, "payload" jsonb NOT NULL, "published_at" timestamptz NULL, "attempt_count" bigint NOT NULL DEFAULT 0, "next_attempt_at" timestamptz NULL, "last_error" character varying NOT NULL DEFAULT '', "dead_lettered_at" timestamptz NULL, PRIMARY KEY ("id"));
-- create index "outboxevent_published_at_dead_lettered_at_created_at" to table: "outbox_events"
CREATE INDEX "outboxevent_published_at_dead_lettered_at_created_at" ON "outbox_events" ("published_at", "dead_lettered_at", "created_at");
-- create "payout_accounts" table
CREATE TABLE "payout_accounts" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "user_id" character varying NOT NULL, "country_code" character varying NOT NULL, "bank_code" character varying NOT NULL, "bank_name" character varying NOT NULL, "account_number_ciphertext" bytea NOT NULL, "account_number_fingerprint" character varying NOT NULL, "account_number_last4" character varying NOT NULL, "account_name" character varying NOT NULL, "name_match_status" character varying NOT NULL DEFAULT 'unverified', "is_default" boolean NOT NULL DEFAULT false, "deleted_at" timestamptz NULL, PRIMARY KEY ("id"));
-- create index "payoutaccount_user_id_account_number_fingerprint_bank_code" to table: "payout_accounts"
CREATE INDEX "payoutaccount_user_id_account_number_fingerprint_bank_code" ON "payout_accounts" ("user_id", "account_number_fingerprint", "bank_code");
-- create index "payoutaccount_user_id_deleted_at" to table: "payout_accounts"
CREATE INDEX "payoutaccount_user_id_deleted_at" ON "payout_accounts" ("user_id", "deleted_at");
-- create "wallet_risk_flags" table
CREATE TABLE "wallet_risk_flags" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "user_id" character varying NOT NULL, "reason" character varying NOT NULL, "subject_id" character varying NOT NULL DEFAULT '', "coins_shortfall" bigint NOT NULL DEFAULT 0, "resolved_at" timestamptz NULL, PRIMARY KEY ("id"));
-- create index "walletriskflag_user_id_resolved_at" to table: "wallet_risk_flags"
CREATE INDEX "walletriskflag_user_id_resolved_at" ON "wallet_risk_flags" ("user_id", "resolved_at");
-- create "withdrawals" table
CREATE TABLE "withdrawals" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "user_id" character varying NOT NULL, "payout_account_id" uuid NOT NULL, "reference" character varying NOT NULL, "amount_minor" bigint NOT NULL, "fee_minor" bigint NOT NULL, "net_minor" bigint NOT NULL, "currency" character varying NOT NULL, "provider" character varying NOT NULL, "destination_label" character varying NOT NULL DEFAULT '', "status" character varying NOT NULL DEFAULT 'pending_review', "failure_reason" character varying NOT NULL DEFAULT '', "reviewed_by_staff_id" character varying NOT NULL DEFAULT '', "reviewed_at" timestamptz NULL, "processed_at" timestamptz NULL, "version" bigint NOT NULL DEFAULT 0, "updated_at" timestamptz NOT NULL, PRIMARY KEY ("id"), CONSTRAINT "withdrawals_amounts_valid" CHECK ((amount_minor > 0) AND (fee_minor >= 0) AND (net_minor > 0) AND ((net_minor + fee_minor) = amount_minor)));
-- create index "withdrawal_reference" to table: "withdrawals"
CREATE UNIQUE INDEX "withdrawal_reference" ON "withdrawals" ("reference");
-- create index "withdrawal_status_created_at" to table: "withdrawals"
CREATE INDEX "withdrawal_status_created_at" ON "withdrawals" ("status", "created_at");
-- create index "withdrawal_user_id_created_at" to table: "withdrawals"
CREATE INDEX "withdrawal_user_id_created_at" ON "withdrawals" ("user_id", "created_at");
