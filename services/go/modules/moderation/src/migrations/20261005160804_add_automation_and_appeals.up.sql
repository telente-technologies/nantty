-- create "appeals" table
CREATE TABLE "appeals" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "source_key" character varying NOT NULL, "decision_type" character varying NOT NULL, "appellant_id" uuid NOT NULL, "report_id" uuid NULL, "strike_id" uuid NULL, "target_type" character varying NOT NULL, "target_id" character varying NOT NULL, "target" jsonb NOT NULL, "original_decision" jsonb NOT NULL, "statement" character varying NOT NULL, "evidence_notes" jsonb NOT NULL, "status" character varying NOT NULL DEFAULT 'pending', "submitted_at" timestamptz NOT NULL, "sla_due_at" timestamptz NOT NULL, "decision" jsonb NULL, PRIMARY KEY ("id"));
-- create index "appeal_appellant_id" to table: "appeals"
CREATE INDEX "appeal_appellant_id" ON "appeals" ("appellant_id");
-- create index "appeal_source_key" to table: "appeals"
CREATE UNIQUE INDEX "appeal_source_key" ON "appeals" ("source_key");
-- create index "appeal_status_sla_due_at" to table: "appeals"
CREATE INDEX "appeal_status_sla_due_at" ON "appeals" ("status", "sla_due_at");
-- create index "appeal_strike_id" to table: "appeals"
CREATE INDEX "appeal_strike_id" ON "appeals" ("strike_id");
-- create "automation_event_occurrences" table
CREATE TABLE "automation_event_occurrences" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "event" character varying NOT NULL, "subject_key" character varying NOT NULL, "source_event_id" character varying NULL, "occurred_at" timestamptz NOT NULL, PRIMARY KEY ("id"));
-- create index "automationeventoccurrence_event_subject_key_occurred_at" to table: "automation_event_occurrences"
CREATE INDEX "automationeventoccurrence_event_subject_key_occurred_at" ON "automation_event_occurrences" ("event", "subject_key", "occurred_at");
-- create index "automationeventoccurrence_occurred_at" to table: "automation_event_occurrences"
CREATE INDEX "automationeventoccurrence_occurred_at" ON "automation_event_occurrences" ("occurred_at");
-- create index "automationeventoccurrence_source_event_id" to table: "automation_event_occurrences"
CREATE UNIQUE INDEX "automationeventoccurrence_source_event_id" ON "automation_event_occurrences" ("source_event_id");
-- create "automation_executions" table
CREATE TABLE "automation_executions" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "rule_id" character varying NOT NULL, "rule_version" bigint NOT NULL, "rule_name" character varying NOT NULL, "event" character varying NOT NULL, "subject_key" character varying NOT NULL, "subject_label" character varying NOT NULL DEFAULT '', "status" character varying NOT NULL, "steps" jsonb NOT NULL, "input" jsonb NOT NULL, "actions_run" jsonb NOT NULL, "error" character varying NULL, "started_at" timestamptz NOT NULL, "finished_at" timestamptz NULL, PRIMARY KEY ("id"));
-- create index "automationexecution_rule_id_started_at" to table: "automation_executions"
CREATE INDEX "automationexecution_rule_id_started_at" ON "automation_executions" ("rule_id", "started_at");
-- create index "automationexecution_rule_id_subject_key_status_started_at" to table: "automation_executions"
CREATE INDEX "automationexecution_rule_id_subject_key_status_started_at" ON "automation_executions" ("rule_id", "subject_key", "status", "started_at");
-- create index "automationexecution_started_at" to table: "automation_executions"
CREATE INDEX "automationexecution_started_at" ON "automation_executions" ("started_at");
-- create "automation_rules" table
CREATE TABLE "automation_rules" ("id" character varying NOT NULL, "version" bigint NOT NULL, "event" character varying NOT NULL, "is_enabled" boolean NOT NULL DEFAULT false, "is_archived" boolean NOT NULL DEFAULT false, "content" jsonb NOT NULL, "change_reason" character varying NOT NULL, "updated_by_id" character varying NOT NULL DEFAULT '', "updated_by_name" character varying NOT NULL DEFAULT '', "created_at" timestamptz NOT NULL, "updated_at" timestamptz NOT NULL, PRIMARY KEY ("id"));
-- create index "automationrule_event_is_enabled_is_archived" to table: "automation_rules"
CREATE INDEX "automationrule_event_is_enabled_is_archived" ON "automation_rules" ("event", "is_enabled", "is_archived");
-- create "automation_rule_versions" table
CREATE TABLE "automation_rule_versions" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "rule_id" character varying NOT NULL, "version" bigint NOT NULL, "content" jsonb NOT NULL, "change_reason" character varying NOT NULL, "updated_by_id" character varying NOT NULL DEFAULT '', "updated_by_name" character varying NOT NULL DEFAULT '', "is_archived" boolean NOT NULL DEFAULT false, PRIMARY KEY ("id"));
-- create index "automationruleversion_rule_id_version" to table: "automation_rule_versions"
CREATE UNIQUE INDEX "automationruleversion_rule_id_version" ON "automation_rule_versions" ("rule_id", "version");
-- backfill pending strike appeals into the unified appeals queue
INSERT INTO "appeals" ("id", "created_at", "source_key", "decision_type", "appellant_id", "strike_id", "target_type", "target_id", "target", "original_decision", "statement", "evidence_notes", "status", "submitted_at", "sla_due_at")
SELECT gen_random_uuid(), now(), 'strike:' || s."id", CASE WHEN s."source" = 'copyright' THEN 'copyright_takedown' ELSE 'strike' END, s."account_id", s."id", 'user', s."account_id"::text, '{}'::jsonb,
  jsonb_build_object('action', upper(s."kind"), 'reason', s."reason", 'decidedByName', s."issued_by_name", 'decidedByStaffId', s."issued_by_id", 'decidedAt', to_char(s."created_at" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), 'reportId', NULL),
  s."appeal_message", '[]'::jsonb, 'pending', COALESCE(s."appealed_at", now()), COALESCE(s."appealed_at", now()) + interval '48 hours'
FROM "strikes" s WHERE s."appeal_status" = 'pending';
