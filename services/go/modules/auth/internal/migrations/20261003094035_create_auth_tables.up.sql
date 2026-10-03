-- create "accounts" table
CREATE TABLE "accounts" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "email" character varying NULL, "username" character varying NOT NULL, "password_hash" character varying NULL, "name" character varying NOT NULL DEFAULT '', "birthday" date NULL, "roles" jsonb NOT NULL, "email_verified_at" timestamptz NULL, "status" character varying NOT NULL DEFAULT 'active', "updated_at" timestamptz NOT NULL, PRIMARY KEY ("id"));
-- create index "account_email" to table: "accounts"
CREATE UNIQUE INDEX "account_email" ON "accounts" ("email");
-- create index "account_username" to table: "accounts"
CREATE UNIQUE INDEX "account_username" ON "accounts" ("username");
-- create "one_time_codes" table
CREATE TABLE "one_time_codes" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "destination" character varying NOT NULL, "purpose" character varying NOT NULL, "secret_hash" character varying NOT NULL, "expires_at" timestamptz NOT NULL, "failed_attempts" bigint NOT NULL DEFAULT 0, "consumed_at" timestamptz NULL, PRIMARY KEY ("id"));
-- create index "onetimecode_destination_purpose_consumed_at" to table: "one_time_codes"
CREATE INDEX "onetimecode_destination_purpose_consumed_at" ON "one_time_codes" ("destination", "purpose", "consumed_at");
-- create index "onetimecode_secret_hash" to table: "one_time_codes"
CREATE UNIQUE INDEX "onetimecode_secret_hash" ON "one_time_codes" ("secret_hash");
-- create "outbox_events" table
CREATE TABLE "outbox_events" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "event_type" character varying NOT NULL, "subject" character varying NOT NULL, "payload" jsonb NOT NULL, "published_at" timestamptz NULL, PRIMARY KEY ("id"));
-- create index "outboxevent_published_at_created_at" to table: "outbox_events"
CREATE INDEX "outboxevent_published_at_created_at" ON "outbox_events" ("published_at", "created_at");
-- create "signing_keys" table
CREATE TABLE "signing_keys" ("id" character varying NOT NULL, "algorithm" character varying NOT NULL, "public_key_jwk" bytea NOT NULL, "encrypted_private_key" bytea NOT NULL, "created_at" timestamptz NOT NULL, "retired_at" timestamptz NULL, "published_until" timestamptz NOT NULL, PRIMARY KEY ("id"));
-- create index "signingkey_published_until" to table: "signing_keys"
CREATE INDEX "signingkey_published_until" ON "signing_keys" ("published_until");
-- create index "signingkey_retired_at" to table: "signing_keys"
CREATE INDEX "signingkey_retired_at" ON "signing_keys" ("retired_at");
-- create "sessions" table
CREATE TABLE "sessions" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "user_agent" character varying NOT NULL DEFAULT '', "ip_address" character varying NOT NULL DEFAULT '', "last_used_at" timestamptz NOT NULL, "expires_at" timestamptz NOT NULL, "revoked_at" timestamptz NULL, "revoked_reason" character varying NULL, "account_id" uuid NOT NULL, PRIMARY KEY ("id"), CONSTRAINT "sessions_accounts_sessions" FOREIGN KEY ("account_id") REFERENCES "accounts" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION);
-- create index "session_account_id_revoked_at" to table: "sessions"
CREATE INDEX "session_account_id_revoked_at" ON "sessions" ("account_id", "revoked_at");
-- create "refresh_tokens" table
CREATE TABLE "refresh_tokens" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "token_hash" character varying NOT NULL, "expires_at" timestamptz NOT NULL, "used_at" timestamptz NULL, "replaced_by_id" uuid NULL, "session_id" uuid NOT NULL, PRIMARY KEY ("id"), CONSTRAINT "refresh_tokens_sessions_refresh_tokens" FOREIGN KEY ("session_id") REFERENCES "sessions" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION);
-- create index "refreshtoken_token_hash" to table: "refresh_tokens"
CREATE UNIQUE INDEX "refreshtoken_token_hash" ON "refresh_tokens" ("token_hash");
