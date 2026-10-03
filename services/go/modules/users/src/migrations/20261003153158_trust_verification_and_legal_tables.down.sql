-- reverse: create index "verificationapplication_status_created_at" to table: "verification_applications"
DROP INDEX "verificationapplication_status_created_at";
-- reverse: create index "verificationapplication_profile_id_status" to table: "verification_applications"
DROP INDEX "verificationapplication_profile_id_status";
-- reverse: create "verification_applications" table
DROP TABLE "verification_applications";
-- reverse: create index "suggestiondismissal_profile_id_color" to table: "suggestion_dismissals"
DROP INDEX "suggestiondismissal_profile_id_color";
-- reverse: create "suggestion_dismissals" table
DROP TABLE "suggestion_dismissals";
-- reverse: create index "profilesignal_profile_id" to table: "profile_signals"
DROP INDEX "profilesignal_profile_id";
-- reverse: create index "profilesignal_account_id" to table: "profile_signals"
DROP INDEX "profilesignal_account_id";
-- reverse: create "profile_signals" table
DROP TABLE "profile_signals";
-- reverse: create index "profilecheckmark_status_reverification_due_at" to table: "profile_checkmarks"
DROP INDEX "profilecheckmark_status_reverification_due_at";
-- reverse: create index "profilecheckmark_profile_id" to table: "profile_checkmarks"
DROP INDEX "profilecheckmark_profile_id";
-- reverse: create index "profilecheckmark_account_id" to table: "profile_checkmarks"
DROP INDEX "profilecheckmark_account_id";
-- reverse: create "profile_checkmarks" table
DROP TABLE "profile_checkmarks";
-- reverse: create index "legalversion_status_published_at" to table: "legal_versions"
DROP INDEX "legalversion_status_published_at";
-- reverse: create index "legalversion_one_open_per_document" to table: "legal_versions"
DROP INDEX "legalversion_one_open_per_document";
-- reverse: create index "legalversion_document_key_version_number" to table: "legal_versions"
DROP INDEX "legalversion_document_key_version_number";
-- reverse: create "legal_versions" table
DROP TABLE "legal_versions";
-- reverse: create index "legalnoticedraft_version_id" to table: "legal_notice_drafts"
DROP INDEX "legalnoticedraft_version_id";
-- reverse: create "legal_notice_drafts" table
DROP TABLE "legal_notice_drafts";
-- reverse: create index "legalnotice_version_id" to table: "legal_notices"
DROP INDEX "legalnotice_version_id";
-- reverse: create index "legalnotice_status_created_at" to table: "legal_notices"
DROP INDEX "legalnotice_status_created_at";
-- reverse: create "legal_notices" table
DROP TABLE "legal_notices";
-- reverse: create index "legaldocument_key" to table: "legal_documents"
DROP INDEX "legaldocument_key";
-- reverse: create "legal_documents" table
DROP TABLE "legal_documents";
-- reverse: create index "creatorapplication_status_created_at" to table: "creator_applications"
DROP INDEX "creatorapplication_status_created_at";
-- reverse: create index "creatorapplication_account_id_created_at" to table: "creator_applications"
DROP INDEX "creatorapplication_account_id_created_at";
-- reverse: create "creator_applications" table
DROP TABLE "creator_applications";
-- reverse: create index "checkmarkgrant_revoked_at_created_at" to table: "checkmark_grants"
DROP INDEX "checkmarkgrant_revoked_at_created_at";
-- reverse: create index "checkmarkgrant_profile_id_revoked_at" to table: "checkmark_grants"
DROP INDEX "checkmarkgrant_profile_id_revoked_at";
-- reverse: create "checkmark_grants" table
DROP TABLE "checkmark_grants";
-- reverse: create index "businessdocument_status_created_at" to table: "business_documents"
DROP INDEX "businessdocument_status_created_at";
-- reverse: create index "businessdocument_account_id_kind_is_current" to table: "business_documents"
DROP INDEX "businessdocument_account_id_kind_is_current";
-- reverse: create "business_documents" table
DROP TABLE "business_documents";
-- reverse: create index "blackapplication_status_created_at" to table: "black_applications"
DROP INDEX "blackapplication_status_created_at";
-- reverse: create index "blackapplication_profile_id" to table: "black_applications"
DROP INDEX "blackapplication_profile_id";
-- reverse: create "black_applications" table
DROP TABLE "black_applications";
-- reverse: create index "admincreatedaccount_account_id" to table: "admin_created_accounts"
DROP INDEX "admincreatedaccount_account_id";
-- reverse: create "admin_created_accounts" table
DROP TABLE "admin_created_accounts";
-- reverse: create index "accountsuspension_status_deletion_due_at" to table: "account_suspensions"
DROP INDEX "accountsuspension_status_deletion_due_at";
-- reverse: create index "accountsuspension_appeal_status_status" to table: "account_suspensions"
DROP INDEX "accountsuspension_appeal_status_status";
-- reverse: create index "accountsuspension_account_id_status" to table: "account_suspensions"
DROP INDEX "accountsuspension_account_id_status";
-- reverse: create "account_suspensions" table
DROP TABLE "account_suspensions";
-- reverse: create index "accountrestriction_account_id_ends_at" to table: "account_restrictions"
DROP INDEX "accountrestriction_account_id_ends_at";
-- reverse: create "account_restrictions" table
DROP TABLE "account_restrictions";
-- reverse: create index "accountremoval_account_id" to table: "account_removals"
DROP INDEX "accountremoval_account_id";
-- reverse: create "account_removals" table
DROP TABLE "account_removals";
-- reverse: create index "accountban_lifted_at_ends_at" to table: "account_bans"
DROP INDEX "accountban_lifted_at_ends_at";
-- reverse: create index "accountban_account_id_lifted_at" to table: "account_bans"
DROP INDEX "accountban_account_id_lifted_at";
-- reverse: create "account_bans" table
DROP TABLE "account_bans";
-- reverse: modify "terms_acceptances" table
ALTER TABLE "terms_acceptances" DROP COLUMN "policy_version_id";
-- reverse: modify "profiles" table
ALTER TABLE "profiles" DROP COLUMN "profile_type";
-- reverse: modify "privacy_settings" table
ALTER TABLE "privacy_settings" DROP COLUMN "who_can_mention_me", DROP COLUMN "who_can_message_me";
