-- reverse: create index "strike_reference_type_reference_id" to table: "strikes"
DROP INDEX "strike_reference_type_reference_id";
-- reverse: create index "strike_account_id_revoked_at_expires_at" to table: "strikes"
DROP INDEX "strike_account_id_revoked_at_expires_at";
-- reverse: create index "strike_account_id_reference_key" to table: "strikes"
DROP INDEX "strike_account_id_reference_key";
-- reverse: create "strikes" table
DROP TABLE "strikes";
-- reverse: create index "ipclaim_status_sla_due_at" to table: "ip_claims"
DROP INDEX "ipclaim_status_sla_due_at";
-- reverse: create index "ipclaim_listing_id" to table: "ip_claims"
DROP INDEX "ipclaim_listing_id";
-- reverse: create index "ipclaim_idempotency_key" to table: "ip_claims"
DROP INDEX "ipclaim_idempotency_key";
-- reverse: create index "ipclaim_accused_seller_id" to table: "ip_claims"
DROP INDEX "ipclaim_accused_seller_id";
-- reverse: create "ip_claims" table
DROP TABLE "ip_claims";
-- reverse: create index "counternotice_status_restore_eligible_at" to table: "counter_notices"
DROP INDEX "counternotice_status_restore_eligible_at";
-- reverse: create index "counternotice_claim_id_status" to table: "counter_notices"
DROP INDEX "counternotice_claim_id_status";
-- reverse: create "counter_notices" table
DROP TABLE "counter_notices";
-- reverse: create index "copyrightclaim_target_type_target_id" to table: "copyright_claims"
DROP INDEX "copyrightclaim_target_type_target_id";
-- reverse: create index "copyrightclaim_status_created_at" to table: "copyright_claims"
DROP INDEX "copyrightclaim_status_created_at";
-- reverse: create index "copyrightclaim_infringer_id" to table: "copyright_claims"
DROP INDEX "copyrightclaim_infringer_id";
-- reverse: create index "copyrightclaim_claimant_user_id_idempotency_key" to table: "copyright_claims"
DROP INDEX "copyrightclaim_claimant_user_id_idempotency_key";
-- reverse: create "copyright_claims" table
DROP TABLE "copyright_claims";
-- reverse: create index "contentreportentry_source_event_id" to table: "content_report_entries"
DROP INDEX "contentreportentry_source_event_id";
-- reverse: create index "contentreportentry_reporter_id_created_at" to table: "content_report_entries"
DROP INDEX "contentreportentry_reporter_id_created_at";
-- reverse: create index "contentreportentry_report_id_reporter_id" to table: "content_report_entries"
DROP INDEX "contentreportentry_report_id_reporter_id";
-- reverse: create "content_report_entries" table
DROP TABLE "content_report_entries";
-- reverse: create index "contentreport_target_type_target_id" to table: "content_reports"
DROP INDEX "contentreport_target_type_target_id";
-- reverse: create index "contentreport_status_priority_sla_due_at" to table: "content_reports"
DROP INDEX "contentreport_status_priority_sla_due_at";
-- reverse: create index "contentreport_author_id" to table: "content_reports"
DROP INDEX "contentreport_author_id";
-- reverse: create "content_reports" table
DROP TABLE "content_reports";
