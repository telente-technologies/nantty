-- create "security_account_states" table
CREATE TABLE "security_account_states" ("id" uuid NOT NULL, "challenge_required" boolean NOT NULL DEFAULT false, "challenge_reason" character varying NOT NULL DEFAULT '', "flagged_at" timestamptz NULL, "cleared_until" timestamptz NULL, "suspected_bot" boolean NOT NULL DEFAULT false, "bot_score" double precision NOT NULL DEFAULT 0, "bot_reasons" jsonb NOT NULL, "bot_marked_at" timestamptz NULL, "headless_reported" boolean NOT NULL DEFAULT false, "attestation_verdict" character varying NOT NULL DEFAULT '', "auto_suspended_at" timestamptz NULL, "updated_at" timestamptz NOT NULL, PRIMARY KEY ("id"));
-- create index "securityaccountstate_challenge_required" to table: "security_account_states"
CREATE INDEX "securityaccountstate_challenge_required" ON "security_account_states" ("challenge_required");
-- create index "securityaccountstate_suspected_bot" to table: "security_account_states"
CREATE INDEX "securityaccountstate_suspected_bot" ON "security_account_states" ("suspected_bot");
-- create "security_cases" table
CREATE TABLE "security_cases" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "account_id" uuid NOT NULL, "trigger" character varying NOT NULL, "status" character varying NOT NULL DEFAULT 'open', "severity" character varying NOT NULL DEFAULT 'medium', "violation_count" bigint NOT NULL DEFAULT 0, "failed_challenge_count" bigint NOT NULL DEFAULT 0, "passed_challenge_count" bigint NOT NULL DEFAULT 0, "auto_suspended" boolean NOT NULL DEFAULT false, "last_activity_at" timestamptz NOT NULL, "decision" jsonb NULL, "decided_at" timestamptz NULL, PRIMARY KEY ("id"));
-- create index "securitycase_account_id_created_at" to table: "security_cases"
CREATE INDEX "securitycase_account_id_created_at" ON "security_cases" ("account_id", "created_at");
-- create index "securitycase_open_account_id" to table: "security_cases"
CREATE UNIQUE INDEX "securitycase_open_account_id" ON "security_cases" ("account_id") WHERE ((status)::text = 'open'::text);
-- create index "securitycase_status_severity_last_activity_at" to table: "security_cases"
CREATE INDEX "securitycase_status_severity_last_activity_at" ON "security_cases" ("status", "severity", "last_activity_at");
-- create "security_events" table
CREATE TABLE "security_events" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "account_id" uuid NULL, "kind" character varying NOT NULL, "device_id" character varying NOT NULL DEFAULT '', "ip_prefix" character varying NOT NULL DEFAULT '', "source" character varying NOT NULL DEFAULT '', "external_reference" character varying NULL, "detail" jsonb NULL, PRIMARY KEY ("id"));
-- create index "securityevent_account_id_created_at" to table: "security_events"
CREATE INDEX "securityevent_account_id_created_at" ON "security_events" ("account_id", "created_at");
-- create index "securityevent_account_id_kind_created_at" to table: "security_events"
CREATE INDEX "securityevent_account_id_kind_created_at" ON "security_events" ("account_id", "kind", "created_at");
-- create index "securityevent_external_reference" to table: "security_events"
CREATE UNIQUE INDEX "securityevent_external_reference" ON "security_events" ("external_reference");
