-- reverse: create index "staffsession_staff_id_revoked_at" to table: "staff_sessions"
DROP INDEX "staffsession_staff_id_revoked_at";
-- reverse: create index "staffsession_refresh_hash" to table: "staff_sessions"
DROP INDEX "staffsession_refresh_hash";
-- reverse: create index "staffsession_previous_refresh_hash" to table: "staff_sessions"
DROP INDEX "staffsession_previous_refresh_hash";
-- reverse: create "staff_sessions" table
DROP TABLE "staff_sessions";
-- reverse: create index "staffloginchallenge_token_hash" to table: "staff_login_challenges"
DROP INDEX "staffloginchallenge_token_hash";
-- reverse: create "staff_login_challenges" table
DROP TABLE "staff_login_challenges";
-- reverse: create index "staffinvitation_token_hash" to table: "staff_invitations"
DROP INDEX "staffinvitation_token_hash";
-- reverse: create "staff_invitations" table
DROP TABLE "staff_invitations";
-- reverse: create index "staffaccount_email" to table: "staff_accounts"
DROP INDEX "staffaccount_email";
-- reverse: create "staff_accounts" table
DROP TABLE "staff_accounts";
-- reverse: create index "platformsettingrevision_key_version" to table: "platform_setting_revisions"
DROP INDEX "platformsettingrevision_key_version";
-- reverse: create "platform_setting_revisions" table
DROP TABLE "platform_setting_revisions";
-- reverse: create index "platformsetting_key" to table: "platform_settings"
DROP INDEX "platformsetting_key";
-- reverse: create "platform_settings" table
DROP TABLE "platform_settings";
-- reverse: create index "outboxevent_published_at_created_at" to table: "outbox_events"
DROP INDEX "outboxevent_published_at_created_at";
-- reverse: create "outbox_events" table
DROP TABLE "outbox_events";
-- reverse: create index "auditevent_subject_type_subject_id" to table: "audit_events"
DROP INDEX "auditevent_subject_type_subject_id";
-- reverse: create index "auditevent_actor_id_created_at" to table: "audit_events"
DROP INDEX "auditevent_actor_id_created_at";
-- reverse: create index "auditevent_action_created_at" to table: "audit_events"
DROP INDEX "auditevent_action_created_at";
-- reverse: create "audit_events" table
DROP TABLE "audit_events";
