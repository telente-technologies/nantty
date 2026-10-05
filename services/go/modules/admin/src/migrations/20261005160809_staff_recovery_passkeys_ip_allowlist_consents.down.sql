-- reverse: create index "staffwebauthncredential_staff_id" to table: "staff_webauthn_credentials"
DROP INDEX "staffwebauthncredential_staff_id";
-- reverse: create index "staffwebauthncredential_credential_id" to table: "staff_webauthn_credentials"
DROP INDEX "staffwebauthncredential_credential_id";
-- reverse: create "staff_webauthn_credentials" table
DROP TABLE "staff_webauthn_credentials";
-- reverse: create index "staffconsent_staff_id_created_at" to table: "staff_consents"
DROP INDEX "staffconsent_staff_id_created_at";
-- reverse: create "staff_consents" table
GRANT UPDATE, DELETE, TRUNCATE ON "staff_consents" TO CURRENT_USER;
DROP TABLE "staff_consents";
-- reverse: modify "staff_sessions" table
ALTER TABLE "staff_sessions" DROP COLUMN "webauthn_expires_at", DROP COLUMN "webauthn_ceremony", DROP COLUMN "webauthn_session";
-- reverse: modify "staff_login_challenges" table
ALTER TABLE "staff_login_challenges" DROP COLUMN "webauthn_session";
-- reverse: modify "staff_accounts" table
ALTER TABLE "staff_accounts" DROP COLUMN "theme_preference", DROP COLUMN "ip_allow_list", DROP COLUMN "recovery_code_hashes";
