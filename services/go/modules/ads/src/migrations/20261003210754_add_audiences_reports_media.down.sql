-- reverse: create index "adscheduledreport_next_send_at" to table: "ad_scheduled_reports"
DROP INDEX "adscheduledreport_next_send_at";
-- reverse: create index "adscheduledreport_account_id_created_at" to table: "ad_scheduled_reports"
DROP INDEX "adscheduledreport_account_id_created_at";
-- reverse: create "ad_scheduled_reports" table
DROP TABLE "ad_scheduled_reports";
-- reverse: create index "admedia_status_created_at" to table: "ad_media"
DROP INDEX "admedia_status_created_at";
-- reverse: create index "admedia_account_id_created_at" to table: "ad_media"
DROP INDEX "admedia_account_id_created_at";
-- reverse: create "ad_media" table
DROP TABLE "ad_media";
-- reverse: create index "adcustomaudience_account_id_idempotency_key" to table: "ad_custom_audiences"
DROP INDEX "adcustomaudience_account_id_idempotency_key";
-- reverse: create index "adcustomaudience_account_id_created_at" to table: "ad_custom_audiences"
DROP INDEX "adcustomaudience_account_id_created_at";
-- reverse: create "ad_custom_audiences" table
DROP TABLE "ad_custom_audiences";
-- reverse: create index "adaudiencemember_user_id" to table: "ad_audience_members"
DROP INDEX "adaudiencemember_user_id";
-- reverse: create index "adaudiencemember_audience_id_user_id" to table: "ad_audience_members"
DROP INDEX "adaudiencemember_audience_id_user_id";
-- reverse: create "ad_audience_members" table
DROP TABLE "ad_audience_members";
