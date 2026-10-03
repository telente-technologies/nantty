-- modify "privacy_settings" table
ALTER TABLE "privacy_settings" ADD COLUMN "who_can_message_me" character varying NOT NULL DEFAULT 'everyone', ADD COLUMN "who_can_mention_me" character varying NOT NULL DEFAULT 'everyone';
-- modify "profiles" table
ALTER TABLE "profiles" ADD COLUMN "profile_type" character varying NOT NULL DEFAULT 'personal';
-- modify "terms_acceptances" table
ALTER TABLE "terms_acceptances" ADD COLUMN "policy_version_id" uuid NULL;
-- create "account_bans" table
CREATE TABLE "account_bans" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "account_id" uuid NOT NULL, "reason" character varying NOT NULL, "ends_at" timestamptz NULL, "banned_by" character varying NOT NULL, "banned_by_name" character varying NOT NULL DEFAULT '', "lifted_at" timestamptz NULL, "lifted_by" character varying NOT NULL DEFAULT '', PRIMARY KEY ("id"));
-- create index "accountban_account_id_lifted_at" to table: "account_bans"
CREATE INDEX "accountban_account_id_lifted_at" ON "account_bans" ("account_id", "lifted_at");
-- create index "accountban_lifted_at_ends_at" to table: "account_bans"
CREATE INDEX "accountban_lifted_at_ends_at" ON "account_bans" ("lifted_at", "ends_at");
-- create "account_removals" table
CREATE TABLE "account_removals" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "account_id" uuid NOT NULL, "username" character varying NOT NULL, "trigger" character varying NOT NULL, "reason" character varying NOT NULL DEFAULT '', "deleted_by" character varying NOT NULL DEFAULT '', "applied_steps" jsonb NULL, "retained_until" timestamptz NOT NULL, PRIMARY KEY ("id"));
-- create index "accountremoval_account_id" to table: "account_removals"
CREATE INDEX "accountremoval_account_id" ON "account_removals" ("account_id");
-- create "account_restrictions" table
CREATE TABLE "account_restrictions" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "account_id" uuid NOT NULL, "features" jsonb NOT NULL, "reason" character varying NOT NULL, "ends_at" timestamptz NOT NULL, "created_by" character varying NOT NULL, "created_by_name" character varying NOT NULL DEFAULT '', "lifted_at" timestamptz NULL, PRIMARY KEY ("id"));
-- create index "accountrestriction_account_id_ends_at" to table: "account_restrictions"
CREATE INDEX "accountrestriction_account_id_ends_at" ON "account_restrictions" ("account_id", "ends_at");
-- create "account_suspensions" table
CREATE TABLE "account_suspensions" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "account_id" uuid NOT NULL, "source" character varying NOT NULL DEFAULT 'staff', "reason_code" character varying NOT NULL DEFAULT 'OTHER', "note" character varying NOT NULL DEFAULT '', "suspended_by" character varying NOT NULL DEFAULT '', "suspended_by_name" character varying NOT NULL DEFAULT '', "ends_at" timestamptz NULL, "deletion_due_at" timestamptz NOT NULL, "status" character varying NOT NULL DEFAULT 'active', "closed_at" timestamptz NULL, "appeal_status" character varying NOT NULL DEFAULT 'none', "appeal_message" character varying NOT NULL DEFAULT '', "appeal_submitted_at" timestamptz NULL, "appeal_decision_note" character varying NOT NULL DEFAULT '', "appeal_decided_by" character varying NOT NULL DEFAULT '', PRIMARY KEY ("id"));
-- create index "accountsuspension_account_id_status" to table: "account_suspensions"
CREATE INDEX "accountsuspension_account_id_status" ON "account_suspensions" ("account_id", "status");
-- create index "accountsuspension_appeal_status_status" to table: "account_suspensions"
CREATE INDEX "accountsuspension_appeal_status_status" ON "account_suspensions" ("appeal_status", "status");
-- create index "accountsuspension_status_deletion_due_at" to table: "account_suspensions"
CREATE INDEX "accountsuspension_status_deletion_due_at" ON "account_suspensions" ("status", "deletion_due_at");
-- create "admin_created_accounts" table
CREATE TABLE "admin_created_accounts" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "account_id" uuid NOT NULL, "profile_type" character varying NOT NULL, "created_by" character varying NOT NULL, "created_by_name" character varying NOT NULL DEFAULT '', "reason" character varying NOT NULL, "bypassed_reserved_entries" jsonb NOT NULL, PRIMARY KEY ("id"));
-- create index "admincreatedaccount_account_id" to table: "admin_created_accounts"
CREATE UNIQUE INDEX "admincreatedaccount_account_id" ON "admin_created_accounts" ("account_id");
-- create "black_applications" table
CREATE TABLE "black_applications" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "profile_id" uuid NOT NULL, "account_id" uuid NOT NULL, "agency_name" character varying NOT NULL, "handle" character varying NOT NULL, "representative_name" character varying NOT NULL, "representative_role" character varying NOT NULL, "status" character varying NOT NULL DEFAULT 'in_review', "checklist" jsonb NOT NULL, "first_approval_by" character varying NOT NULL DEFAULT '', "first_approval_by_name" character varying NOT NULL DEFAULT '', "first_approval_at" timestamptz NULL, "second_approval_by" character varying NOT NULL DEFAULT '', "second_approval_by_name" character varying NOT NULL DEFAULT '', "second_approval_at" timestamptz NULL, "decision_reason" character varying NOT NULL DEFAULT '', "reverification_due_at" timestamptz NULL, "reverification_reminded_at" timestamptz NULL, "handle_reserved" boolean NOT NULL DEFAULT false, PRIMARY KEY ("id"));
-- create index "blackapplication_profile_id" to table: "black_applications"
CREATE INDEX "blackapplication_profile_id" ON "black_applications" ("profile_id");
-- create index "blackapplication_status_created_at" to table: "black_applications"
CREATE INDEX "blackapplication_status_created_at" ON "black_applications" ("status", "created_at");
-- create "business_documents" table
CREATE TABLE "business_documents" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "account_id" uuid NOT NULL, "profile_id" uuid NULL, "kind" character varying NOT NULL, "object_key" character varying NOT NULL, "file_name" character varying NOT NULL, "content_type" character varying NOT NULL, "size_bytes" bigint NOT NULL, "is_uploaded" boolean NOT NULL DEFAULT false, "is_current" boolean NOT NULL DEFAULT true, "status" character varying NOT NULL DEFAULT 'pending', "rejection_reason" character varying NOT NULL DEFAULT '', "reviewed_by_name" character varying NOT NULL DEFAULT '', "reviewed_at" timestamptz NULL, PRIMARY KEY ("id"));
-- create index "businessdocument_account_id_kind_is_current" to table: "business_documents"
CREATE INDEX "businessdocument_account_id_kind_is_current" ON "business_documents" ("account_id", "kind", "is_current");
-- create index "businessdocument_status_created_at" to table: "business_documents"
CREATE INDEX "businessdocument_status_created_at" ON "business_documents" ("status", "created_at");
-- create "checkmark_grants" table
CREATE TABLE "checkmark_grants" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "profile_id" uuid NOT NULL, "account_id" uuid NOT NULL, "color" character varying NOT NULL, "reason" character varying NOT NULL, "granted_by" character varying NOT NULL, "granted_by_name" character varying NOT NULL DEFAULT '', "revoked_at" timestamptz NULL, "revoked_by_name" character varying NOT NULL DEFAULT '', "revoked_reason" character varying NOT NULL DEFAULT '', PRIMARY KEY ("id"));
-- create index "checkmarkgrant_profile_id_revoked_at" to table: "checkmark_grants"
CREATE INDEX "checkmarkgrant_profile_id_revoked_at" ON "checkmark_grants" ("profile_id", "revoked_at");
-- create index "checkmarkgrant_revoked_at_created_at" to table: "checkmark_grants"
CREATE INDEX "checkmarkgrant_revoked_at_created_at" ON "checkmark_grants" ("revoked_at", "created_at");
-- create "creator_applications" table
CREATE TABLE "creator_applications" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "account_id" uuid NOT NULL, "profile_id" uuid NOT NULL, "status" character varying NOT NULL DEFAULT 'pending', "decision" character varying NOT NULL, "decision_note" character varying NOT NULL DEFAULT '', "requirements" jsonb NULL, "content_categories" jsonb NOT NULL, "social_links" jsonb NULL, "sample_content_urls" jsonb NOT NULL, "payout_account_id" character varying NOT NULL DEFAULT '', "accepted_terms_version" character varying NOT NULL DEFAULT '', "reviewed_by" character varying NOT NULL DEFAULT '', "reviewed_by_name" character varying NOT NULL DEFAULT '', "reviewed_at" timestamptz NULL, "decision_reason" character varying NOT NULL DEFAULT '', "reapply_available_at" timestamptz NULL, PRIMARY KEY ("id"));
-- create index "creatorapplication_account_id_created_at" to table: "creator_applications"
CREATE INDEX "creatorapplication_account_id_created_at" ON "creator_applications" ("account_id", "created_at");
-- create index "creatorapplication_status_created_at" to table: "creator_applications"
CREATE INDEX "creatorapplication_status_created_at" ON "creator_applications" ("status", "created_at");
-- create "legal_documents" table
CREATE TABLE "legal_documents" ("id" bigint NOT NULL GENERATED BY DEFAULT AS IDENTITY, "key" character varying NOT NULL, "title" character varying NOT NULL, "public_path" character varying NOT NULL, PRIMARY KEY ("id"));
-- create index "legaldocument_key" to table: "legal_documents"
CREATE UNIQUE INDEX "legaldocument_key" ON "legal_documents" ("key");
-- create "legal_notices" table
CREATE TABLE "legal_notices" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "version_id" uuid NOT NULL, "document_key" character varying NOT NULL, "version_number" bigint NOT NULL, "subject" character varying NOT NULL, "status" character varying NOT NULL DEFAULT 'queued', "recipient_count" bigint NOT NULL DEFAULT 0, "sent_count" bigint NOT NULL DEFAULT 0, "excluded_hard_bounces" bigint NOT NULL DEFAULT 0, "excluded_suppressed" bigint NOT NULL DEFAULT 0, "batch_size" bigint NOT NULL DEFAULT 50, "rate_per_second" bigint NOT NULL DEFAULT 14, "batches_done" bigint NOT NULL DEFAULT 0, "queued_by" character varying NOT NULL DEFAULT '', "queued_by_name" character varying NOT NULL DEFAULT '', "updated_at" timestamptz NOT NULL, PRIMARY KEY ("id"));
-- create index "legalnotice_status_created_at" to table: "legal_notices"
CREATE INDEX "legalnotice_status_created_at" ON "legal_notices" ("status", "created_at");
-- create index "legalnotice_version_id" to table: "legal_notices"
CREATE INDEX "legalnotice_version_id" ON "legal_notices" ("version_id");
-- create "legal_notice_drafts" table
CREATE TABLE "legal_notice_drafts" ("id" bigint NOT NULL GENERATED BY DEFAULT AS IDENTITY, "version_id" uuid NOT NULL, "subject" character varying NOT NULL DEFAULT '', "summary_text" text NOT NULL DEFAULT '', "what_changed" jsonb NOT NULL, "reaccept_note" character varying NOT NULL DEFAULT '', "updated_by_name" character varying NOT NULL DEFAULT '', "test_sends" jsonb NULL, "updated_at" timestamptz NOT NULL, PRIMARY KEY ("id"));
-- create index "legalnoticedraft_version_id" to table: "legal_notice_drafts"
CREATE UNIQUE INDEX "legalnoticedraft_version_id" ON "legal_notice_drafts" ("version_id");
-- create "legal_versions" table
CREATE TABLE "legal_versions" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "document_key" character varying NOT NULL, "version_number" bigint NOT NULL, "status" character varying NOT NULL DEFAULT 'draft', "body_markdown" text NOT NULL, "change_summary" character varying NOT NULL DEFAULT '', "effective_at" timestamptz NOT NULL, "is_material_change" boolean NOT NULL DEFAULT false, "is_flagged_for_legal_review" boolean NOT NULL DEFAULT false, "created_by" character varying NOT NULL, "created_by_name" character varying NOT NULL DEFAULT '', "submitted_by" character varying NOT NULL DEFAULT '', "submitted_by_name" character varying NOT NULL DEFAULT '', "submitted_at" timestamptz NULL, "published_by" character varying NOT NULL DEFAULT '', "published_by_name" character varying NOT NULL DEFAULT '', "published_at" timestamptz NULL, "returned_reason" character varying NOT NULL DEFAULT '', "rolled_back_from_version_number" bigint NULL, "notice_id" uuid NULL, PRIMARY KEY ("id"));
-- create index "legalversion_document_key_version_number" to table: "legal_versions"
CREATE UNIQUE INDEX "legalversion_document_key_version_number" ON "legal_versions" ("document_key", "version_number");
-- create index "legalversion_one_open_per_document" to table: "legal_versions"
CREATE UNIQUE INDEX "legalversion_one_open_per_document" ON "legal_versions" ("document_key") WHERE ((status)::text = ANY ((ARRAY['draft'::character varying, 'in_review'::character varying])::text[]));
-- create index "legalversion_status_published_at" to table: "legal_versions"
CREATE INDEX "legalversion_status_published_at" ON "legal_versions" ("status", "published_at");
-- create "profile_checkmarks" table
CREATE TABLE "profile_checkmarks" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "profile_id" uuid NOT NULL, "account_id" uuid NOT NULL, "color" character varying NOT NULL, "status" character varying NOT NULL DEFAULT 'verified', "source" character varying NOT NULL, "source_id" uuid NULL, "current_period_end" timestamptz NULL, "reverification_due_at" timestamptz NULL, "grace_ends_at" timestamptz NULL, "handle_reserved" boolean NOT NULL DEFAULT false, "updated_at" timestamptz NOT NULL, PRIMARY KEY ("id"));
-- create index "profilecheckmark_account_id" to table: "profile_checkmarks"
CREATE INDEX "profilecheckmark_account_id" ON "profile_checkmarks" ("account_id");
-- create index "profilecheckmark_profile_id" to table: "profile_checkmarks"
CREATE UNIQUE INDEX "profilecheckmark_profile_id" ON "profile_checkmarks" ("profile_id");
-- create index "profilecheckmark_status_reverification_due_at" to table: "profile_checkmarks"
CREATE INDEX "profilecheckmark_status_reverification_due_at" ON "profile_checkmarks" ("status", "reverification_due_at");
-- create "profile_signals" table
CREATE TABLE "profile_signals" ("id" bigint NOT NULL GENERATED BY DEFAULT AS IDENTITY, "profile_id" uuid NOT NULL, "account_id" uuid NOT NULL, "real_followers" bigint NOT NULL DEFAULT 0, "original_posts_last_60_days" bigint NOT NULL DEFAULT 0, "days_since_last_violation" bigint NOT NULL DEFAULT 100000, "fraud_score" bigint NOT NULL DEFAULT 0, "risk_score" bigint NOT NULL DEFAULT 0, "id_verified" boolean NOT NULL DEFAULT false, "borderline_content" boolean NOT NULL DEFAULT false, "completed_orders" bigint NOT NULL DEFAULT 0, "success_rate_percent" bigint NOT NULL DEFAULT 0, "has_active_store_or_brand_page" boolean NOT NULL DEFAULT false, "seller_plan" character varying NOT NULL DEFAULT 'FREE', "source" character varying NOT NULL DEFAULT '', "updated_at" timestamptz NOT NULL, PRIMARY KEY ("id"));
-- create index "profilesignal_account_id" to table: "profile_signals"
CREATE INDEX "profilesignal_account_id" ON "profile_signals" ("account_id");
-- create index "profilesignal_profile_id" to table: "profile_signals"
CREATE UNIQUE INDEX "profilesignal_profile_id" ON "profile_signals" ("profile_id");
-- create "suggestion_dismissals" table
CREATE TABLE "suggestion_dismissals" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "profile_id" uuid NOT NULL, "color" character varying NOT NULL, PRIMARY KEY ("id"));
-- create index "suggestiondismissal_profile_id_color" to table: "suggestion_dismissals"
CREATE UNIQUE INDEX "suggestiondismissal_profile_id_color" ON "suggestion_dismissals" ("profile_id", "color");
-- create "verification_applications" table
CREATE TABLE "verification_applications" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "profile_id" uuid NOT NULL, "account_id" uuid NOT NULL, "color" character varying NOT NULL, "plan_id" character varying NOT NULL DEFAULT '', "status" character varying NOT NULL DEFAULT 'pending', "applicant" jsonb NULL, "document_keys" jsonb NOT NULL, "decision_reason" character varying NOT NULL DEFAULT '', "reviewed_by_name" character varying NOT NULL DEFAULT '', "reviewed_at" timestamptz NULL, "billing_confirmed_at" timestamptz NULL, PRIMARY KEY ("id"));
-- create index "verificationapplication_profile_id_status" to table: "verification_applications"
CREATE INDEX "verificationapplication_profile_id_status" ON "verification_applications" ("profile_id", "status");
-- create index "verificationapplication_status_created_at" to table: "verification_applications"
CREATE INDEX "verificationapplication_status_created_at" ON "verification_applications" ("status", "created_at");
