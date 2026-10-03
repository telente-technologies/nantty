-- reverse: create index "registrationblock_kind_value_hash_lifted_at" to table: "registration_blocks"
DROP INDEX "registrationblock_kind_value_hash_lifted_at";
-- reverse: create index "registrationblock_account_id" to table: "registration_blocks"
DROP INDEX "registrationblock_account_id";
-- reverse: create "registration_blocks" table
DROP TABLE "registration_blocks";
-- reverse: modify "sessions" table
ALTER TABLE "sessions" DROP COLUMN "device_hash";
-- reverse: modify "accounts" table
ALTER TABLE "accounts" DROP COLUMN "must_change_password", DROP COLUMN "phone_verified_at", DROP COLUMN "phone_hash";
