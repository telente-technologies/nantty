-- create "audit_events" table
CREATE TABLE "audit_events" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "actor_id" character varying NOT NULL, "actor_role" character varying NOT NULL DEFAULT '', "action" character varying NOT NULL, "subject_type" character varying NOT NULL DEFAULT '', "subject_id" character varying NOT NULL DEFAULT '', "before" jsonb NULL, "after" jsonb NULL, "reason" character varying NOT NULL DEFAULT '', "ip_address" character varying NOT NULL DEFAULT '', "user_agent" character varying NOT NULL DEFAULT '', "request_id" character varying NOT NULL DEFAULT '', PRIMARY KEY ("id"));
-- create index "auditevent_action_created_at" to table: "audit_events"
CREATE INDEX "auditevent_action_created_at" ON "audit_events" ("action", "created_at");
-- create index "auditevent_actor_id_created_at" to table: "audit_events"
CREATE INDEX "auditevent_actor_id_created_at" ON "audit_events" ("actor_id", "created_at");
-- create index "auditevent_subject_type_subject_id" to table: "audit_events"
CREATE INDEX "auditevent_subject_type_subject_id" ON "audit_events" ("subject_type", "subject_id");
-- create "outbox_events" table
CREATE TABLE "outbox_events" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "event_type" character varying NOT NULL, "subject" character varying NOT NULL, "payload" jsonb NOT NULL, "published_at" timestamptz NULL, PRIMARY KEY ("id"));
-- create index "outboxevent_published_at_created_at" to table: "outbox_events"
CREATE INDEX "outboxevent_published_at_created_at" ON "outbox_events" ("published_at", "created_at");
-- create "platform_settings" table
CREATE TABLE "platform_settings" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "key" character varying NOT NULL, "value" jsonb NOT NULL, "version" bigint NOT NULL, "updated_by" character varying NOT NULL, "updated_at" timestamptz NOT NULL, PRIMARY KEY ("id"));
-- create index "platformsetting_key" to table: "platform_settings"
CREATE UNIQUE INDEX "platformsetting_key" ON "platform_settings" ("key");
-- create "platform_setting_revisions" table
CREATE TABLE "platform_setting_revisions" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "key" character varying NOT NULL, "version" bigint NOT NULL, "value" jsonb NOT NULL, "reason" character varying NOT NULL, "actor" character varying NOT NULL, PRIMARY KEY ("id"));
-- create index "platformsettingrevision_key_version" to table: "platform_setting_revisions"
CREATE UNIQUE INDEX "platformsettingrevision_key_version" ON "platform_setting_revisions" ("key", "version");
-- create "staff_accounts" table
CREATE TABLE "staff_accounts" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "email" character varying NOT NULL, "display_name" character varying NOT NULL DEFAULT '', "role" character varying NOT NULL, "permissions" jsonb NOT NULL, "password_hash" character varying NULL, "status" character varying NOT NULL DEFAULT 'invited', "totp_secret_encrypted" bytea NULL, "totp_confirmed_at" timestamptz NULL, "totp_last_used_step" bigint NOT NULL DEFAULT 0, "failed_attempts" bigint NOT NULL DEFAULT 0, "locked_until" timestamptz NULL, "created_by" uuid NULL, "updated_at" timestamptz NOT NULL, PRIMARY KEY ("id"));
-- create index "staffaccount_email" to table: "staff_accounts"
CREATE UNIQUE INDEX "staffaccount_email" ON "staff_accounts" ("email");
-- create "staff_invitations" table
CREATE TABLE "staff_invitations" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "token_hash" character varying NOT NULL, "expires_at" timestamptz NOT NULL, "consumed_at" timestamptz NULL, "staff_id" uuid NOT NULL, PRIMARY KEY ("id"), CONSTRAINT "staff_invitations_staff_accounts_invitations" FOREIGN KEY ("staff_id") REFERENCES "staff_accounts" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION);
-- create index "staffinvitation_token_hash" to table: "staff_invitations"
CREATE UNIQUE INDEX "staffinvitation_token_hash" ON "staff_invitations" ("token_hash");
-- create "staff_login_challenges" table
CREATE TABLE "staff_login_challenges" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "token_hash" character varying NOT NULL, "purpose" character varying NOT NULL, "expires_at" timestamptz NOT NULL, "consumed_at" timestamptz NULL, "attempts" bigint NOT NULL DEFAULT 0, "staff_id" uuid NOT NULL, PRIMARY KEY ("id"), CONSTRAINT "staff_login_challenges_staff_accounts_challenges" FOREIGN KEY ("staff_id") REFERENCES "staff_accounts" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION);
-- create index "staffloginchallenge_token_hash" to table: "staff_login_challenges"
CREATE UNIQUE INDEX "staffloginchallenge_token_hash" ON "staff_login_challenges" ("token_hash");
-- create "staff_sessions" table
CREATE TABLE "staff_sessions" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "ip_address" character varying NOT NULL DEFAULT '', "user_agent" character varying NOT NULL DEFAULT '', "refresh_hash" character varying NOT NULL, "previous_refresh_hash" character varying NULL, "last_used_at" timestamptz NOT NULL, "expires_at" timestamptz NOT NULL, "revoked_at" timestamptz NULL, "staff_id" uuid NOT NULL, PRIMARY KEY ("id"), CONSTRAINT "staff_sessions_staff_accounts_sessions" FOREIGN KEY ("staff_id") REFERENCES "staff_accounts" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION);
-- create index "staffsession_previous_refresh_hash" to table: "staff_sessions"
CREATE INDEX "staffsession_previous_refresh_hash" ON "staff_sessions" ("previous_refresh_hash");
-- create index "staffsession_refresh_hash" to table: "staff_sessions"
CREATE UNIQUE INDEX "staffsession_refresh_hash" ON "staff_sessions" ("refresh_hash");
-- create index "staffsession_staff_id_revoked_at" to table: "staff_sessions"
CREATE INDEX "staffsession_staff_id_revoked_at" ON "staff_sessions" ("staff_id", "revoked_at");
