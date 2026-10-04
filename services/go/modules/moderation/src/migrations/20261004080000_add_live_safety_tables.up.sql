-- create "legal_reports" table
CREATE TABLE "legal_reports" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "incident_id" uuid NOT NULL, "live_id" character varying NOT NULL, "host_id" uuid NULL, "category" character varying NOT NULL, "provider" character varying NOT NULL DEFAULT '', "match_reference" character varying NOT NULL DEFAULT '', "evidence_key" character varying NOT NULL DEFAULT '', "status" character varying NOT NULL DEFAULT 'pending_legal_review', "external_reference" character varying NOT NULL DEFAULT '', "submitted_at" timestamptz NULL, "updated_at" timestamptz NOT NULL, PRIMARY KEY ("id"));
-- create index "legalreport_incident_id" to table: "legal_reports"
CREATE UNIQUE INDEX "legalreport_incident_id" ON "legal_reports" ("incident_id");
-- create index "legalreport_status_created_at" to table: "legal_reports"
CREATE INDEX "legalreport_status_created_at" ON "legal_reports" ("status", "created_at");
-- create "live_safety_incidents" table
CREATE TABLE "live_safety_incidents" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "live_id" character varying NOT NULL, "host_id" uuid NULL, "status" character varying NOT NULL DEFAULT 'open', "priority" character varying NOT NULL DEFAULT 'normal', "sla_due_at" timestamptz NOT NULL, "hold_active" boolean NOT NULL DEFAULT false, "hold_category" character varying NOT NULL DEFAULT '', "hold_reason" character varying NOT NULL DEFAULT '', "hold_source" character varying NOT NULL DEFAULT '', "hold_started_at" timestamptz NULL, "top_category" character varying NOT NULL DEFAULT '', "top_confidence" double precision NOT NULL DEFAULT 0, "warning_count" bigint NOT NULL DEFAULT 0, "last_warned_at" timestamptz NULL, "report_count" bigint NOT NULL DEFAULT 0, "last_reported_at" timestamptz NULL, "sampling_boost_until" timestamptz NULL, "hash_match" boolean NOT NULL DEFAULT false, "appealed_at" timestamptz NULL, "appeal_message" character varying NOT NULL DEFAULT '', "live_ended_at" timestamptz NULL, "resolution" character varying NOT NULL DEFAULT '', "decision" jsonb NULL, "updated_at" timestamptz NOT NULL, PRIMARY KEY ("id"));
-- create index "livesafetyincident_open_live_id" to table: "live_safety_incidents"
CREATE UNIQUE INDEX "livesafetyincident_open_live_id" ON "live_safety_incidents" ("live_id") WHERE (status = 'open');
-- create index "livesafetyincident_status_priority_sla_due_at" to table: "live_safety_incidents"
CREATE INDEX "livesafetyincident_status_priority_sla_due_at" ON "live_safety_incidents" ("status", "priority", "sla_due_at");
-- create index "livesafetyincident_host_id_created_at" to table: "live_safety_incidents"
CREATE INDEX "livesafetyincident_host_id_created_at" ON "live_safety_incidents" ("host_id", "created_at");
-- create "live_safety_signals" table
CREATE TABLE "live_safety_signals" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "incident_id" uuid NOT NULL, "live_id" character varying NOT NULL, "kind" character varying NOT NULL, "source_key" character varying NOT NULL, "frame_ref" character varying NOT NULL DEFAULT '', "captured_at" timestamptz NULL, "labels" jsonb NULL, "categories" jsonb NULL, "confidence" double precision NOT NULL DEFAULT 0, "suggested_action" character varying NOT NULL DEFAULT '', "model_version" character varying NOT NULL DEFAULT '', "action_taken" character varying NOT NULL DEFAULT 'none', "transcript_snippet" character varying NOT NULL DEFAULT '', "reason" character varying NOT NULL DEFAULT '', "details" character varying NOT NULL DEFAULT '', "reporter_id" uuid NULL, "offset_seconds" double precision NULL, "hash_match" boolean NOT NULL DEFAULT false, PRIMARY KEY ("id"));
-- create index "livesafetysignal_source_key" to table: "live_safety_signals"
CREATE UNIQUE INDEX "livesafetysignal_source_key" ON "live_safety_signals" ("source_key");
-- create index "livesafetysignal_incident_id_created_at" to table: "live_safety_signals"
CREATE INDEX "livesafetysignal_incident_id_created_at" ON "live_safety_signals" ("incident_id", "created_at");
-- create index "livesafetysignal_live_id_kind_created_at" to table: "live_safety_signals"
CREATE INDEX "livesafetysignal_live_id_kind_created_at" ON "live_safety_signals" ("live_id", "kind", "created_at");
