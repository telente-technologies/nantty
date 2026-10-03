-- create "content_reports" table
CREATE TABLE "content_reports" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "target_type" character varying NOT NULL, "target_id" character varying NOT NULL, "author_id" uuid NULL, "status" character varying NOT NULL DEFAULT 'open', "priority" character varying NOT NULL DEFAULT 'normal', "primary_reason" character varying NOT NULL, "reason_counts" jsonb NOT NULL, "report_count" bigint NOT NULL DEFAULT 0, "first_reported_at" timestamptz NOT NULL, "last_reported_at" timestamptz NOT NULL, "sla_due_at" timestamptz NOT NULL, "visibility" character varying NOT NULL DEFAULT 'visible', "source" character varying NOT NULL DEFAULT 'user', "target_preview" jsonb NULL, "classifier_scores" jsonb NULL, "classifier_action" character varying NOT NULL DEFAULT 'none', "decision" jsonb NULL, PRIMARY KEY ("id"));
-- create index "contentreport_author_id" to table: "content_reports"
CREATE INDEX "contentreport_author_id" ON "content_reports" ("author_id");
-- create index "contentreport_status_priority_sla_due_at" to table: "content_reports"
CREATE INDEX "contentreport_status_priority_sla_due_at" ON "content_reports" ("status", "priority", "sla_due_at");
-- create index "contentreport_target_type_target_id" to table: "content_reports"
CREATE UNIQUE INDEX "contentreport_target_type_target_id" ON "content_reports" ("target_type", "target_id");
-- create "content_report_entries" table
CREATE TABLE "content_report_entries" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "report_id" uuid NOT NULL, "reporter_id" uuid NULL, "reason" character varying NOT NULL, "details" character varying NOT NULL DEFAULT '', "source" character varying NOT NULL DEFAULT 'user', "source_event_id" character varying NULL, PRIMARY KEY ("id"));
-- create index "contentreportentry_report_id_reporter_id" to table: "content_report_entries"
CREATE UNIQUE INDEX "contentreportentry_report_id_reporter_id" ON "content_report_entries" ("report_id", "reporter_id");
-- create index "contentreportentry_reporter_id_created_at" to table: "content_report_entries"
CREATE INDEX "contentreportentry_reporter_id_created_at" ON "content_report_entries" ("reporter_id", "created_at");
-- create index "contentreportentry_source_event_id" to table: "content_report_entries"
CREATE UNIQUE INDEX "contentreportentry_source_event_id" ON "content_report_entries" ("source_event_id");
-- create "copyright_claims" table
CREATE TABLE "copyright_claims" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "claimant_user_id" uuid NULL, "claimant_name" character varying NOT NULL DEFAULT '', "claimant_organization" character varying NOT NULL DEFAULT '', "claimant_email" character varying NOT NULL, "represents" character varying NOT NULL DEFAULT '', "work_title" character varying NOT NULL, "work_type" character varying NOT NULL DEFAULT 'video', "target_type" character varying NOT NULL, "target_id" character varying NOT NULL, "infringer_id" uuid NULL, "target_flag" character varying NOT NULL DEFAULT 'visible', "status" character varying NOT NULL DEFAULT 'pending', "rights_basis" character varying NOT NULL, "sworn_statement" character varying NOT NULL, "claimed_urls" jsonb NOT NULL, "target_preview" jsonb NULL, "audio_matches" jsonb NULL, "top_audio_match_percent" bigint NULL, "decision" jsonb NULL, "strike_id" uuid NULL, "idempotency_key" character varying NULL, PRIMARY KEY ("id"));
-- create index "copyrightclaim_claimant_user_id_idempotency_key" to table: "copyright_claims"
CREATE UNIQUE INDEX "copyrightclaim_claimant_user_id_idempotency_key" ON "copyright_claims" ("claimant_user_id", "idempotency_key");
-- create index "copyrightclaim_infringer_id" to table: "copyright_claims"
CREATE INDEX "copyrightclaim_infringer_id" ON "copyright_claims" ("infringer_id");
-- create index "copyrightclaim_status_created_at" to table: "copyright_claims"
CREATE INDEX "copyrightclaim_status_created_at" ON "copyright_claims" ("status", "created_at");
-- create index "copyrightclaim_target_type_target_id" to table: "copyright_claims"
CREATE INDEX "copyrightclaim_target_type_target_id" ON "copyright_claims" ("target_type", "target_id");
-- create "counter_notices" table
CREATE TABLE "counter_notices" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "claim_id" uuid NOT NULL, "submitter_id" uuid NOT NULL, "statement" character varying NOT NULL, "contact_email" character varying NOT NULL, "status" character varying NOT NULL DEFAULT 'pending', "restore_eligible_at" timestamptz NOT NULL, "court_action_recorded" boolean NOT NULL DEFAULT false, "decided_by_id" character varying NOT NULL DEFAULT '', "decision_reason" character varying NOT NULL DEFAULT '', "decided_at" timestamptz NULL, "restored_at" timestamptz NULL, PRIMARY KEY ("id"));
-- create index "counternotice_claim_id_status" to table: "counter_notices"
CREATE INDEX "counternotice_claim_id_status" ON "counter_notices" ("claim_id", "status");
-- create index "counternotice_status_restore_eligible_at" to table: "counter_notices"
CREATE INDEX "counternotice_status_restore_eligible_at" ON "counter_notices" ("status", "restore_eligible_at");
-- create "ip_claims" table
CREATE TABLE "ip_claims" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "kind" character varying NOT NULL, "status" character varying NOT NULL DEFAULT 'open', "claimant_brand_id" character varying NOT NULL, "claimant_brand" jsonb NOT NULL, "claimant_user_id" uuid NULL, "accused_seller_id" uuid NOT NULL, "listing_id" character varying NOT NULL, "listing" jsonb NOT NULL, "listing_status" character varying NOT NULL DEFAULT 'live', "statement" character varying NOT NULL, "trademark_reference" character varying NOT NULL DEFAULT '', "evidence" jsonb NULL, "seller_response" jsonb NULL, "sla_due_at" timestamptz NOT NULL, "decision" jsonb NULL, "strike_id" uuid NULL, "idempotency_key" character varying NULL, PRIMARY KEY ("id"));
-- create index "ipclaim_accused_seller_id" to table: "ip_claims"
CREATE INDEX "ipclaim_accused_seller_id" ON "ip_claims" ("accused_seller_id");
-- create index "ipclaim_idempotency_key" to table: "ip_claims"
CREATE UNIQUE INDEX "ipclaim_idempotency_key" ON "ip_claims" ("idempotency_key");
-- create index "ipclaim_listing_id" to table: "ip_claims"
CREATE INDEX "ipclaim_listing_id" ON "ip_claims" ("listing_id");
-- create index "ipclaim_status_sla_due_at" to table: "ip_claims"
CREATE INDEX "ipclaim_status_sla_due_at" ON "ip_claims" ("status", "sla_due_at");
-- create "strikes" table
CREATE TABLE "strikes" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "account_id" uuid NOT NULL, "kind" character varying NOT NULL DEFAULT 'strike', "policy" character varying NOT NULL, "reason" character varying NOT NULL, "source" character varying NOT NULL, "issued_by_id" character varying NOT NULL DEFAULT '', "issued_by_name" character varying NOT NULL DEFAULT 'System', "reference_type" character varying NOT NULL DEFAULT '', "reference_id" character varying NOT NULL DEFAULT '', "reference_key" character varying NULL, "expires_at" timestamptz NULL, "revoked_at" timestamptz NULL, "revoked_reason" character varying NOT NULL DEFAULT '', PRIMARY KEY ("id"));
-- create index "strike_account_id_reference_key" to table: "strikes"
CREATE UNIQUE INDEX "strike_account_id_reference_key" ON "strikes" ("account_id", "reference_key");
-- create index "strike_account_id_revoked_at_expires_at" to table: "strikes"
CREATE INDEX "strike_account_id_revoked_at_expires_at" ON "strikes" ("account_id", "revoked_at", "expires_at");
-- create index "strike_reference_type_reference_id" to table: "strikes"
CREATE INDEX "strike_reference_type_reference_id" ON "strikes" ("reference_type", "reference_id");
