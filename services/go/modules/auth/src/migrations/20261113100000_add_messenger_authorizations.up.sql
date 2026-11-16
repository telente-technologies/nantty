-- create "messenger_authorizations" table
CREATE TABLE "messenger_authorizations" (
  "id" uuid NOT NULL,
  "created_at" timestamptz NOT NULL,
  "account_id" uuid NOT NULL,
  "proof_hash" character varying NOT NULL,
  "installation_hash" character varying(64) NOT NULL,
  "platform" character varying NOT NULL,
  "device_name" character varying(120) NOT NULL,
  "user_agent" character varying(255) NOT NULL DEFAULT '',
  "ip_address" character varying(64) NOT NULL DEFAULT '',
  "status" character varying NOT NULL DEFAULT 'pending',
  "approval_method" character varying(24) NULL,
  "approved_by_session_id" uuid NULL,
  "code_hash" character varying(64) NULL,
  "code_expires_at" timestamptz NULL,
  "code_issued_at" timestamptz NULL,
  "code_attempts" bigint NOT NULL DEFAULT 0,
  "expires_at" timestamptz NOT NULL,
  "completed_at" timestamptz NULL,
  "completed_session_id" uuid NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "messenger_authorizations_accounts_messenger_authorizations"
    FOREIGN KEY ("account_id") REFERENCES "accounts" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION
);
-- create index "messengerauthorization_proof_hash" to table: "messenger_authorizations"
CREATE UNIQUE INDEX "messengerauthorization_proof_hash" ON "messenger_authorizations" ("proof_hash");
-- create index "messengerauthorization_account_id_created_at" to table: "messenger_authorizations"
CREATE INDEX "messengerauthorization_account_id_created_at" ON "messenger_authorizations" ("account_id", "created_at");
-- create index "messengerauthorization_account_id_status_expires_at" to table: "messenger_authorizations"
CREATE INDEX "messengerauthorization_account_id_status_expires_at" ON "messenger_authorizations" ("account_id", "status", "expires_at");

-- create "messenger_trusted_devices" table
CREATE TABLE "messenger_trusted_devices" (
  "id" uuid NOT NULL,
  "created_at" timestamptz NOT NULL,
  "account_id" uuid NOT NULL,
  "token_hash" character varying(64) NOT NULL,
  "installation_hash" character varying(64) NOT NULL,
  "platform" character varying NOT NULL,
  "device_name" character varying(120) NOT NULL,
  "user_agent" character varying(255) NOT NULL DEFAULT '',
  "last_used_at" timestamptz NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "revoked_at" timestamptz NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "messenger_trusted_devices_accounts_messenger_trusted_devices"
    FOREIGN KEY ("account_id") REFERENCES "accounts" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION
);
-- create unique index "messengertrusteddevice_token_hash" to table: "messenger_trusted_devices"
CREATE UNIQUE INDEX "messengertrusteddevice_token_hash" ON "messenger_trusted_devices" ("token_hash");
-- create index "messengertrusteddevice_account_id_revoked_at" to table: "messenger_trusted_devices"
CREATE INDEX "messengertrusteddevice_account_id_revoked_at" ON "messenger_trusted_devices" ("account_id", "revoked_at");
-- create index "messengertrusteddevice_account_id_installation_hash_revoked_at" to table: "messenger_trusted_devices"
CREATE INDEX "messengertrusteddevice_account_id_installation_hash_revoked_at" ON "messenger_trusted_devices" ("account_id", "installation_hash", "revoked_at");
