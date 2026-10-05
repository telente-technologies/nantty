-- modify "staff_accounts" table
ALTER TABLE "staff_accounts" ADD COLUMN "recovery_code_hashes" jsonb NOT NULL DEFAULT '[]', ADD COLUMN "ip_allow_list" jsonb NOT NULL DEFAULT '[]', ADD COLUMN "theme_preference" character varying NOT NULL DEFAULT 'system';
-- modify "staff_login_challenges" table
ALTER TABLE "staff_login_challenges" ADD COLUMN "webauthn_session" bytea NULL;
-- modify "staff_sessions" table
ALTER TABLE "staff_sessions" ADD COLUMN "webauthn_session" bytea NULL, ADD COLUMN "webauthn_ceremony" character varying NULL, ADD COLUMN "webauthn_expires_at" timestamptz NULL;
-- create "staff_consents" table
CREATE TABLE "staff_consents" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "policy_version" character varying NOT NULL, "categories" jsonb NOT NULL, "source" character varying NOT NULL, "decided_at" timestamptz NOT NULL, "ip_address" character varying NOT NULL DEFAULT '', "user_agent" character varying NOT NULL DEFAULT '', "staff_id" uuid NOT NULL, PRIMARY KEY ("id"), CONSTRAINT "staff_consents_staff_accounts_consents" FOREIGN KEY ("staff_id") REFERENCES "staff_accounts" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION);
-- create index "staffconsent_staff_id_created_at" to table: "staff_consents"
CREATE INDEX "staffconsent_staff_id_created_at" ON "staff_consents" ("staff_id", "created_at");
-- create "staff_webauthn_credentials" table
CREATE TABLE "staff_webauthn_credentials" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "credential_id" character varying NOT NULL, "credential" jsonb NOT NULL, "sign_count" bigint NOT NULL DEFAULT 0, "transports" jsonb NOT NULL DEFAULT '[]', "label" character varying NOT NULL, "last_used_at" timestamptz NULL, "staff_id" uuid NOT NULL, PRIMARY KEY ("id"), CONSTRAINT "staff_webauthn_credentials_staff_accounts_passkeys" FOREIGN KEY ("staff_id") REFERENCES "staff_accounts" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION);
-- create index "staffwebauthncredential_credential_id" to table: "staff_webauthn_credentials"
CREATE UNIQUE INDEX "staffwebauthncredential_credential_id" ON "staff_webauthn_credentials" ("credential_id");
-- create index "staffwebauthncredential_staff_id" to table: "staff_webauthn_credentials"
CREATE INDEX "staffwebauthncredential_staff_id" ON "staff_webauthn_credentials" ("staff_id");
-- consents are append-only
REVOKE UPDATE, DELETE, TRUNCATE ON "staff_consents" FROM CURRENT_USER;
