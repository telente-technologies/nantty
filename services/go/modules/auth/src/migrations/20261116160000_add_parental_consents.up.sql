CREATE TABLE IF NOT EXISTS "parental_consents" (
    "id" uuid NOT NULL,
    "account_id" uuid NOT NULL,
    "parent_email" character varying(320) NOT NULL,
    "guardian_name" character varying(160) NOT NULL,
    "consent_version" character varying(48) NOT NULL,
    "status" character varying(32) NOT NULL DEFAULT 'attested',
    "attested_at" timestamptz NOT NULL,
    "revoked_at" timestamptz NULL,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "parental_consents_account_uidx" ON "parental_consents" ("account_id");
