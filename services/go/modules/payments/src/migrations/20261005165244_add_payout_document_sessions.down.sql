-- reverse: create index "payoutonboarding_document_session_id" to table: "payout_onboardings"
DROP INDEX "payoutonboarding_document_session_id";
-- reverse: modify "payout_onboardings" table
ALTER TABLE "payout_onboardings" DROP COLUMN "document_rejection_reason", DROP COLUMN "document_link_expires_at", DROP COLUMN "document_link_url", DROP COLUMN "document_session_id", DROP COLUMN "document_status";
