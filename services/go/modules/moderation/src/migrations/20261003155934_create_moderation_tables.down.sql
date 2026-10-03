-- reverse: create index "suspensioncase_status_risk_score" to table: "suspension_cases"
DROP INDEX "suspensioncase_status_risk_score";
-- reverse: create index "suspensioncase_external_reference" to table: "suspension_cases"
DROP INDEX "suspensioncase_external_reference";
-- reverse: create index "suspensioncase_account_id" to table: "suspension_cases"
DROP INDEX "suspensioncase_account_id";
-- reverse: create "suspension_cases" table
DROP TABLE "suspension_cases";
-- reverse: create index "outboxevent_published_at_created_at" to table: "outbox_events"
DROP INDEX "outboxevent_published_at_created_at";
-- reverse: create "outbox_events" table
DROP TABLE "outbox_events";
-- reverse: create "evidence_retention_settings" table
DROP TABLE "evidence_retention_settings";
-- reverse: create index "chatreport_status_priority_sla_due_at" to table: "chat_reports"
DROP INDEX "chatreport_status_priority_sla_due_at";
-- reverse: create index "chatreport_reporter_id_idempotency_key" to table: "chat_reports"
DROP INDEX "chatreport_reporter_id_idempotency_key";
-- reverse: create index "chatreport_reporter_id_created_at" to table: "chat_reports"
DROP INDEX "chatreport_reporter_id_created_at";
-- reverse: create index "chatreport_reported_user_id" to table: "chat_reports"
DROP INDEX "chatreport_reported_user_id";
-- reverse: create index "chatreport_evidence_retained_until_evidence_purged_at" to table: "chat_reports"
DROP INDEX "chatreport_evidence_retained_until_evidence_purged_at";
-- reverse: create "chat_reports" table
DROP TABLE "chat_reports";
