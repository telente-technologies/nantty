-- modify "monetisation_holds" table
ALTER TABLE "monetisation_holds" ALTER COLUMN "restrictions" DROP DEFAULT;
-- create "payout_account_resolutions" table
CREATE TABLE "payout_account_resolutions" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "user_id" character varying NOT NULL, "country_code" character varying NOT NULL, "bank_code" character varying NOT NULL, "bank_name" character varying NOT NULL, "account_number_ciphertext" bytea NOT NULL, "account_number_last4" character varying NOT NULL, "account_name" character varying NOT NULL, "expires_at" timestamptz NOT NULL, "used_at" timestamptz NULL, PRIMARY KEY ("id"));
-- create index "payoutaccountresolution_user_id_expires_at" to table: "payout_account_resolutions"
CREATE INDEX "payoutaccountresolution_user_id_expires_at" ON "payout_account_resolutions" ("user_id", "expires_at");
-- create "seller_payout_schedules" table
CREATE TABLE "seller_payout_schedules" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "user_id" character varying NOT NULL, "currency" character varying NOT NULL, "timezone" character varying NOT NULL DEFAULT 'Africa/Lagos', "mode" character varying NOT NULL DEFAULT 'manual', "weekday" bigint NOT NULL DEFAULT 1, "day_of_month" bigint NOT NULL DEFAULT 1, "keep_minimum_minor" bigint NOT NULL DEFAULT 0, "payout_account_id" uuid NULL, "next_run_at" timestamptz NULL, "last_run_on" character varying NOT NULL DEFAULT '', "updated_at" timestamptz NOT NULL, PRIMARY KEY ("id"));
-- create index "sellerpayoutschedule_mode_next_run_at" to table: "seller_payout_schedules"
CREATE INDEX "sellerpayoutschedule_mode_next_run_at" ON "seller_payout_schedules" ("mode", "next_run_at");
-- create index "sellerpayoutschedule_user_id" to table: "seller_payout_schedules"
CREATE UNIQUE INDEX "sellerpayoutschedule_user_id" ON "seller_payout_schedules" ("user_id");
