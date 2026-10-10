-- create "ad_balance_earnings_transfers" table
CREATE TABLE "ad_balance_earnings_transfers" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "ad_account_id" character varying NOT NULL, "user_id" character varying NOT NULL, "idempotency_key" character varying NOT NULL, "amount_minor" bigint NOT NULL, "currency" character varying NOT NULL, "refunded_minor" bigint NOT NULL DEFAULT 0, "updated_at" timestamptz NOT NULL, PRIMARY KEY ("id"), CONSTRAINT "ad_balance_earnings_transfers_amount_positive" CHECK (amount_minor > 0), CONSTRAINT "ad_balance_earnings_transfers_refund_within_amount" CHECK ((refunded_minor >= 0) AND (refunded_minor <= amount_minor)));
-- create index "adbalanceearningstransfer_ad_account_id_user_id_created_at" to table: "ad_balance_earnings_transfers"
CREATE INDEX "adbalanceearningstransfer_ad_account_id_user_id_created_at" ON "ad_balance_earnings_transfers" ("ad_account_id", "user_id", "created_at");
-- create index "adbalanceearningstransfer_user_id_idempotency_key" to table: "ad_balance_earnings_transfers"
CREATE UNIQUE INDEX "adbalanceearningstransfer_user_id_idempotency_key" ON "ad_balance_earnings_transfers" ("user_id", "idempotency_key");
