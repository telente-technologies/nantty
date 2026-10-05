-- reverse: create index "automationruleversion_rule_id_version" to table: "automation_rule_versions"
DROP INDEX "automationruleversion_rule_id_version";
-- reverse: create "automation_rule_versions" table
DROP TABLE "automation_rule_versions";
-- reverse: create index "automationrule_event_is_enabled_is_archived" to table: "automation_rules"
DROP INDEX "automationrule_event_is_enabled_is_archived";
-- reverse: create "automation_rules" table
DROP TABLE "automation_rules";
-- reverse: create index "automationexecution_started_at" to table: "automation_executions"
DROP INDEX "automationexecution_started_at";
-- reverse: create index "automationexecution_rule_id_subject_key_status_started_at" to table: "automation_executions"
DROP INDEX "automationexecution_rule_id_subject_key_status_started_at";
-- reverse: create index "automationexecution_rule_id_started_at" to table: "automation_executions"
DROP INDEX "automationexecution_rule_id_started_at";
-- reverse: create "automation_executions" table
DROP TABLE "automation_executions";
-- reverse: create index "automationeventoccurrence_source_event_id" to table: "automation_event_occurrences"
DROP INDEX "automationeventoccurrence_source_event_id";
-- reverse: create index "automationeventoccurrence_occurred_at" to table: "automation_event_occurrences"
DROP INDEX "automationeventoccurrence_occurred_at";
-- reverse: create index "automationeventoccurrence_event_subject_key_occurred_at" to table: "automation_event_occurrences"
DROP INDEX "automationeventoccurrence_event_subject_key_occurred_at";
-- reverse: create "automation_event_occurrences" table
DROP TABLE "automation_event_occurrences";
-- reverse: create index "appeal_strike_id" to table: "appeals"
DROP INDEX "appeal_strike_id";
-- reverse: create index "appeal_status_sla_due_at" to table: "appeals"
DROP INDEX "appeal_status_sla_due_at";
-- reverse: create index "appeal_source_key" to table: "appeals"
DROP INDEX "appeal_source_key";
-- reverse: create index "appeal_appellant_id" to table: "appeals"
DROP INDEX "appeal_appellant_id";
-- reverse: create "appeals" table
DROP TABLE "appeals";
