-- reverse: create index "securityevent_external_reference" to table: "security_events"
DROP INDEX "securityevent_external_reference";
-- reverse: create index "securityevent_account_id_kind_created_at" to table: "security_events"
DROP INDEX "securityevent_account_id_kind_created_at";
-- reverse: create index "securityevent_account_id_created_at" to table: "security_events"
DROP INDEX "securityevent_account_id_created_at";
-- reverse: create "security_events" table
DROP TABLE "security_events";
-- reverse: create index "securitycase_status_severity_last_activity_at" to table: "security_cases"
DROP INDEX "securitycase_status_severity_last_activity_at";
-- reverse: create index "securitycase_open_account_id" to table: "security_cases"
DROP INDEX "securitycase_open_account_id";
-- reverse: create index "securitycase_account_id_created_at" to table: "security_cases"
DROP INDEX "securitycase_account_id_created_at";
-- reverse: create "security_cases" table
DROP TABLE "security_cases";
-- reverse: create index "securityaccountstate_suspected_bot" to table: "security_account_states"
DROP INDEX "securityaccountstate_suspected_bot";
-- reverse: create index "securityaccountstate_challenge_required" to table: "security_account_states"
DROP INDEX "securityaccountstate_challenge_required";
-- reverse: create "security_account_states" table
DROP TABLE "security_account_states";
