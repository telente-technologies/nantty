-- modify "payout_onboardings" table
ALTER TABLE "payout_onboardings" ADD COLUMN "document_status" character varying NOT NULL DEFAULT 'not_started', ADD COLUMN "document_session_id" character varying NOT NULL DEFAULT '', ADD COLUMN "document_link_url" character varying NOT NULL DEFAULT '', ADD COLUMN "document_link_expires_at" timestamptz NULL, ADD COLUMN "document_rejection_reason" character varying NOT NULL DEFAULT '';
-- create index "payoutonboarding_document_session_id" to table: "payout_onboardings"
CREATE INDEX "payoutonboarding_document_session_id" ON "payout_onboardings" ("document_session_id");
