-- reverse: create index "sellerpayoutschedule_user_id" to table: "seller_payout_schedules"
DROP INDEX "sellerpayoutschedule_user_id";
-- reverse: create index "sellerpayoutschedule_mode_next_run_at" to table: "seller_payout_schedules"
DROP INDEX "sellerpayoutschedule_mode_next_run_at";
-- reverse: create "seller_payout_schedules" table
DROP TABLE "seller_payout_schedules";
-- reverse: create index "payoutaccountresolution_user_id_expires_at" to table: "payout_account_resolutions"
DROP INDEX "payoutaccountresolution_user_id_expires_at";
-- reverse: create "payout_account_resolutions" table
DROP TABLE "payout_account_resolutions";
-- reverse: modify "monetisation_holds" table
ALTER TABLE "monetisation_holds" ALTER COLUMN "restrictions" SET DEFAULT '[]';
