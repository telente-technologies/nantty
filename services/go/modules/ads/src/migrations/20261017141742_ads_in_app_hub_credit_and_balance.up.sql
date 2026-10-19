-- modify "ad_boosts" table
ALTER TABLE "ad_boosts" ADD COLUMN "budget_type" character varying NOT NULL DEFAULT 'daily', ADD COLUMN "added_budget_minor" bigint NOT NULL DEFAULT 0, ADD COLUMN "scheduled_start_at" timestamptz NULL;
-- modify "ad_spend_batches" table
ALTER TABLE "ad_spend_batches" ADD COLUMN "credit_used_minor" bigint NOT NULL DEFAULT 0, ADD COLUMN "cashback_minor" bigint NOT NULL DEFAULT 0, ADD COLUMN "refunded_minor" bigint NOT NULL DEFAULT 0;
-- create "ad_balance_withdrawals" table
CREATE TABLE "ad_balance_withdrawals" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "account_id" uuid NOT NULL, "user_id" uuid NOT NULL, "idempotency_key" character varying NOT NULL, "currency" character varying NOT NULL, "gross_minor" bigint NOT NULL, "fee_minor" bigint NOT NULL, "net_minor" bigint NOT NULL, "status" character varying NOT NULL DEFAULT 'pending', "failure_reason" character varying NOT NULL DEFAULT '', "completed_at" timestamptz NULL, "updated_at" timestamptz NOT NULL, PRIMARY KEY ("id"));
-- create index "adbalancewithdrawal_account_id_created_at" to table: "ad_balance_withdrawals"
CREATE INDEX "adbalancewithdrawal_account_id_created_at" ON "ad_balance_withdrawals" ("account_id", "created_at");
-- create index "adbalancewithdrawal_status_created_at" to table: "ad_balance_withdrawals"
CREATE INDEX "adbalancewithdrawal_status_created_at" ON "ad_balance_withdrawals" ("status", "created_at");
-- create index "adbalancewithdrawal_user_id_idempotency_key" to table: "ad_balance_withdrawals"
CREATE UNIQUE INDEX "adbalancewithdrawal_user_id_idempotency_key" ON "ad_balance_withdrawals" ("user_id", "idempotency_key");
-- create "ad_boost_changes" table
CREATE TABLE "ad_boost_changes" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "boost_id" uuid NOT NULL, "user_id" uuid NOT NULL, "idempotency_key" character varying NOT NULL, "request_hash" character varying NOT NULL, "extra_days" bigint NOT NULL, "new_daily_budget_minor" bigint NOT NULL, "additional_minor" bigint NOT NULL, "currency" character varying NOT NULL, "payment_method" character varying NOT NULL, "status" character varying NOT NULL DEFAULT 'pending_payment', "payment_top_up_id" character varying NOT NULL DEFAULT '', "applied_at" timestamptz NULL, PRIMARY KEY ("id"));
-- create index "adboostchange_boost_id" to table: "ad_boost_changes"
CREATE INDEX "adboostchange_boost_id" ON "ad_boost_changes" ("boost_id");
-- create index "adboostchange_payment_top_up_id" to table: "ad_boost_changes"
CREATE INDEX "adboostchange_payment_top_up_id" ON "ad_boost_changes" ("payment_top_up_id");
-- create index "adboostchange_user_id_idempotency_key" to table: "ad_boost_changes"
CREATE UNIQUE INDEX "adboostchange_user_id_idempotency_key" ON "ad_boost_changes" ("user_id", "idempotency_key");
-- create "ad_cashback_settings" table
CREATE TABLE "ad_cashback_settings" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "user_id" uuid NOT NULL, "enabled" boolean NOT NULL DEFAULT false, "percent" bigint NOT NULL DEFAULT 10, "reason" character varying NOT NULL DEFAULT '', "updated_by_staff_id" character varying NOT NULL DEFAULT '', "updated_by_name" character varying NOT NULL DEFAULT '', "updated_at" timestamptz NOT NULL, PRIMARY KEY ("id"));
-- create index "adcashbacksetting_enabled_updated_at" to table: "ad_cashback_settings"
CREATE INDEX "adcashbacksetting_enabled_updated_at" ON "ad_cashback_settings" ("enabled", "updated_at");
-- create index "adcashbacksetting_user_id" to table: "ad_cashback_settings"
CREATE UNIQUE INDEX "adcashbacksetting_user_id" ON "ad_cashback_settings" ("user_id");
-- create "ad_credit_lots" table
CREATE TABLE "ad_credit_lots" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "account_id" uuid NOT NULL, "user_id" uuid NOT NULL, "currency" character varying NOT NULL, "source" character varying NOT NULL, "original_minor" bigint NOT NULL, "remaining_minor" bigint NOT NULL, "expires_at" timestamptz NULL, "status" character varying NOT NULL DEFAULT 'active', "reason" character varying NOT NULL DEFAULT '', "reference" character varying NOT NULL, "issued_by_staff_id" character varying NOT NULL DEFAULT '', "issued_by_name" character varying NOT NULL DEFAULT '', "boost_id" uuid NULL, "spend_batch_id" uuid NULL, "expired_minor" bigint NOT NULL DEFAULT 0, "revoked_minor" bigint NOT NULL DEFAULT 0, "revoked_at" timestamptz NULL, "revoked_by_staff_id" character varying NOT NULL DEFAULT '', "revoke_reason" character varying NOT NULL DEFAULT '', "updated_at" timestamptz NOT NULL, PRIMARY KEY ("id"), CONSTRAINT "ad_credit_lots_amounts" CHECK ((remaining_minor >= 0) AND (remaining_minor <= original_minor) AND (original_minor > 0)));
-- create index "adcreditlot_account_id_status_expires_at" to table: "ad_credit_lots"
CREATE INDEX "adcreditlot_account_id_status_expires_at" ON "ad_credit_lots" ("account_id", "status", "expires_at");
-- create index "adcreditlot_boost_id" to table: "ad_credit_lots"
CREATE INDEX "adcreditlot_boost_id" ON "ad_credit_lots" ("boost_id");
-- create index "adcreditlot_reference" to table: "ad_credit_lots"
CREATE UNIQUE INDEX "adcreditlot_reference" ON "ad_credit_lots" ("reference");
-- create index "adcreditlot_status_expires_at" to table: "ad_credit_lots"
CREATE INDEX "adcreditlot_status_expires_at" ON "ad_credit_lots" ("status", "expires_at");
-- create index "adcreditlot_user_id_created_at" to table: "ad_credit_lots"
CREATE INDEX "adcreditlot_user_id_created_at" ON "ad_credit_lots" ("user_id", "created_at");
-- move existing promotional credit into credit lots
INSERT INTO "ad_credit_lots" ("id", "created_at", "account_id", "user_id", "currency", "source", "original_minor", "remaining_minor", "expires_at", "status", "reason", "reference", "updated_at")
SELECT gen_random_uuid(), now(), "id", "owner_user_id", "currency", 'legacy', "credit_minor", "credit_minor", "credit_expires_at", 'active', 'Ad credit before separate credit lots', 'legacy:' || "id"::text, now()
FROM "ad_accounts" WHERE "credit_minor" > 0;
UPDATE "ad_accounts" SET "credit_expires_at" = NULL WHERE "credit_minor" > 0;
-- reclassify unspent free Premium boost funding from balance to credit
WITH "free_boost_unspent" AS (
  SELECT b."id" AS "boost_id", b."account_id", b."user_id", b."currency",
    GREATEST(b."total_budget_minor" - COALESCE((SELECT CEIL(SUM(i."charge_micros") / 1000000.0)::bigint FROM "ad_impressions" i WHERE i."campaign_id" = b."campaign_id" AND i."charge_micros" > 0), 0), 0) AS "unspent_minor"
  FROM "ad_boosts" b WHERE b."payment_method" = 'free' AND b."status" IN ('in_review', 'active')
), "movable" AS (
  SELECT f.*, LEAST(f."unspent_minor", a."balance_minor") AS "moved_minor" FROM "free_boost_unspent" f JOIN "ad_accounts" a ON a."id" = f."account_id"
), "lots" AS (
  INSERT INTO "ad_credit_lots" ("id", "created_at", "account_id", "user_id", "currency", "source", "original_minor", "remaining_minor", "status", "reason", "reference", "boost_id", "updated_at")
  SELECT gen_random_uuid(), now(), m."account_id", m."user_id", m."currency", 'premium_free_boost', m."moved_minor", m."moved_minor", 'active', 'Free Premium boost', 'freeBoost:' || m."boost_id"::text, m."boost_id", now()
  FROM "movable" m WHERE m."moved_minor" > 0 RETURNING "account_id", "remaining_minor"
)
UPDATE "ad_accounts" a SET "balance_minor" = a."balance_minor" - t."moved", "credit_minor" = a."credit_minor" + t."moved"
FROM (SELECT "account_id", SUM("remaining_minor") AS "moved" FROM "lots" GROUP BY "account_id") t WHERE a."id" = t."account_id";
