-- Extend black_applications with institutional identity, jurisdiction, institutional email verification, and private checkout authorization.
ALTER TABLE "black_applications" ADD COLUMN IF NOT EXISTS "legal_identity_name" character varying NOT NULL DEFAULT '';
ALTER TABLE "black_applications" ADD COLUMN IF NOT EXISTS "legal_registration_ref" character varying NOT NULL DEFAULT '';
ALTER TABLE "black_applications" ADD COLUMN IF NOT EXISTS "jurisdiction_country_code" character varying(2) NOT NULL DEFAULT '';
ALTER TABLE "black_applications" ADD COLUMN IF NOT EXISTS "official_website" character varying NOT NULL DEFAULT '';
ALTER TABLE "black_applications" ADD COLUMN IF NOT EXISTS "official_contact_phone" character varying NOT NULL DEFAULT '';
ALTER TABLE "black_applications" ADD COLUMN IF NOT EXISTS "institutional_email" character varying NOT NULL DEFAULT '';
ALTER TABLE "black_applications" ADD COLUMN IF NOT EXISTS "institutional_email_verified" boolean NOT NULL DEFAULT false;
ALTER TABLE "black_applications" ADD COLUMN IF NOT EXISTS "institutional_email_verified_at" timestamptz NULL;
ALTER TABLE "black_applications" ADD COLUMN IF NOT EXISTS "representative_email" character varying NOT NULL DEFAULT '';
ALTER TABLE "black_applications" ADD COLUMN IF NOT EXISTS "representative_id_ref" character varying NOT NULL DEFAULT '';
ALTER TABLE "black_applications" ADD COLUMN IF NOT EXISTS "evidence_notes" text NOT NULL DEFAULT '';
ALTER TABLE "black_applications" ADD COLUMN IF NOT EXISTS "private_checkout_enabled" boolean NOT NULL DEFAULT false;
ALTER TABLE "black_applications" ADD COLUMN IF NOT EXISTS "private_checkout_authorized_by" character varying NOT NULL DEFAULT '';
ALTER TABLE "black_applications" ADD COLUMN IF NOT EXISTS "private_checkout_authorized_at" timestamptz NULL;
ALTER TABLE "black_applications" ADD COLUMN IF NOT EXISTS "private_checkout_expires_at" timestamptz NULL;
ALTER TABLE "black_applications" ADD COLUMN IF NOT EXISTS "private_checkout_revoked_at" timestamptz NULL;

CREATE TABLE IF NOT EXISTS "black_institutional_email_otps" (
    "id" uuid NOT NULL,
    "application_id" uuid NOT NULL,
    "account_id" uuid NOT NULL,
    "email" character varying NOT NULL,
    "otp_hash" character varying NOT NULL,
    "attempts" integer NOT NULL DEFAULT 0,
    "max_attempts" integer NOT NULL DEFAULT 5,
    "expires_at" timestamptz NOT NULL,
    "verified_at" timestamptz NULL,
    "invalidated_at" timestamptz NULL,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "black_email_otp_app_created_idx" ON "black_institutional_email_otps" ("application_id", "created_at");

CREATE TABLE IF NOT EXISTS "black_verification_appeals" (
    "id" uuid NOT NULL,
    "application_id" uuid NOT NULL,
    "profile_id" uuid NOT NULL,
    "account_id" uuid NOT NULL,
    "reason" text NOT NULL,
    "supporting_details" text NOT NULL DEFAULT '',
    "status" character varying NOT NULL DEFAULT 'open',
    "reviewed_by_staff_id" character varying NOT NULL DEFAULT '',
    "reviewed_by_name" character varying NOT NULL DEFAULT '',
    "decision_note" text NOT NULL DEFAULT '',
    "reviewed_at" timestamptz NULL,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "black_appeal_app_created_idx" ON "black_verification_appeals" ("application_id", "created_at");

GRANT SELECT ("id", "profile_id", "account_id", "agency_name", "handle", "status", "jurisdiction_country_code", "institutional_email", "institutional_email_verified", "private_checkout_enabled", "private_checkout_authorized_at", "private_checkout_expires_at", "private_checkout_revoked_at", "reverification_due_at", "handle_reserved") ON "black_applications" TO nantty_readers;
GRANT SELECT ("id", "application_id", "profile_id", "account_id", "status", "created_at", "reviewed_at") ON "black_verification_appeals" TO nantty_readers;
