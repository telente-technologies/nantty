-- create "ad_balance_top_ups" table
CREATE TABLE "ad_balance_top_ups" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "ad_account_id" character varying NOT NULL, "funded_by_user_id" character varying NOT NULL, "reference" character varying NOT NULL, "payment_intent_id" uuid NOT NULL, "amount_minor" bigint NOT NULL, "currency" character varying NOT NULL, "status" character varying NOT NULL DEFAULT 'pending', "refunded_minor" bigint NOT NULL DEFAULT 0, "credited_at" timestamptz NULL, "updated_at" timestamptz NOT NULL, PRIMARY KEY ("id"), CONSTRAINT "ad_balance_top_ups_amount_positive" CHECK (amount_minor > 0), CONSTRAINT "ad_balance_top_ups_refund_within_amount" CHECK ((refunded_minor >= 0) AND (refunded_minor <= amount_minor)));
-- create index "adbalancetopup_ad_account_id_status_created_at" to table: "ad_balance_top_ups"
CREATE INDEX "adbalancetopup_ad_account_id_status_created_at" ON "ad_balance_top_ups" ("ad_account_id", "status", "created_at");
-- create index "adbalancetopup_funded_by_user_id_created_at" to table: "ad_balance_top_ups"
CREATE INDEX "adbalancetopup_funded_by_user_id_created_at" ON "ad_balance_top_ups" ("funded_by_user_id", "created_at");
-- create index "adbalancetopup_reference" to table: "ad_balance_top_ups"
CREATE UNIQUE INDEX "adbalancetopup_reference" ON "ad_balance_top_ups" ("reference");
-- create "ad_spend_debits" table
CREATE TABLE "ad_spend_debits" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "batch_id" character varying NOT NULL, "idempotency_key" character varying NOT NULL, "ad_account_id" character varying NOT NULL, "currency" character varying NOT NULL, "requested_minor" bigint NOT NULL, "debited_minor" bigint NOT NULL, "shortfall_minor" bigint NOT NULL, "impression_count" bigint NOT NULL DEFAULT 0, PRIMARY KEY ("id"));
-- create index "adspenddebit_ad_account_id_created_at" to table: "ad_spend_debits"
CREATE INDEX "adspenddebit_ad_account_id_created_at" ON "ad_spend_debits" ("ad_account_id", "created_at");
-- create index "adspenddebit_idempotency_key" to table: "ad_spend_debits"
CREATE UNIQUE INDEX "adspenddebit_idempotency_key" ON "ad_spend_debits" ("idempotency_key");
-- create "seller_reserve_flags" table
CREATE TABLE "seller_reserve_flags" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "seller_user_id" character varying NOT NULL, "reserve_bps" bigint NOT NULL DEFAULT 0, "hold_days" bigint NOT NULL DEFAULT 90, "reason" character varying NOT NULL, "flagged_by_staff_id" character varying NOT NULL, "released_at" timestamptz NULL, "released_by_staff_id" character varying NOT NULL DEFAULT '', PRIMARY KEY ("id"));
-- create index "seller_reserve_flags_active" to table: "seller_reserve_flags"
CREATE UNIQUE INDEX "seller_reserve_flags_active" ON "seller_reserve_flags" ("seller_user_id") WHERE (released_at IS NULL);
