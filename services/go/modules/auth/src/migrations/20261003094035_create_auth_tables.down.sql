-- reverse: create index "refreshtoken_token_hash" to table: "refresh_tokens"
DROP INDEX "refreshtoken_token_hash";
-- reverse: create "refresh_tokens" table
DROP TABLE "refresh_tokens";
-- reverse: create index "session_account_id_revoked_at" to table: "sessions"
DROP INDEX "session_account_id_revoked_at";
-- reverse: create "sessions" table
DROP TABLE "sessions";
-- reverse: create index "signingkey_retired_at" to table: "signing_keys"
DROP INDEX "signingkey_retired_at";
-- reverse: create index "signingkey_published_until" to table: "signing_keys"
DROP INDEX "signingkey_published_until";
-- reverse: create "signing_keys" table
DROP TABLE "signing_keys";
-- reverse: create index "outboxevent_published_at_created_at" to table: "outbox_events"
DROP INDEX "outboxevent_published_at_created_at";
-- reverse: create "outbox_events" table
DROP TABLE "outbox_events";
-- reverse: create index "onetimecode_secret_hash" to table: "one_time_codes"
DROP INDEX "onetimecode_secret_hash";
-- reverse: create index "onetimecode_destination_purpose_consumed_at" to table: "one_time_codes"
DROP INDEX "onetimecode_destination_purpose_consumed_at";
-- reverse: create "one_time_codes" table
DROP TABLE "one_time_codes";
-- reverse: create index "account_username" to table: "accounts"
DROP INDEX "account_username";
-- reverse: create index "account_email" to table: "accounts"
DROP INDEX "account_email";
-- reverse: create "accounts" table
DROP TABLE "accounts";
