-- modify "accounts" table
ALTER TABLE "accounts" ADD COLUMN "phone_hash" character varying NULL, ADD COLUMN "phone_verified_at" timestamptz NULL, ADD COLUMN "must_change_password" boolean NOT NULL DEFAULT false;
-- modify "sessions" table
ALTER TABLE "sessions" ADD COLUMN "device_hash" character varying NULL;
-- create "registration_blocks" table
CREATE TABLE "registration_blocks" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "kind" character varying NOT NULL, "value_hash" character varying NOT NULL, "account_id" uuid NOT NULL, "reason" character varying NOT NULL DEFAULT '', "created_by" character varying NOT NULL DEFAULT '', "lifted_at" timestamptz NULL, PRIMARY KEY ("id"));
-- create index "registrationblock_account_id" to table: "registration_blocks"
CREATE INDEX "registrationblock_account_id" ON "registration_blocks" ("account_id");
-- create index "registrationblock_kind_value_hash_lifted_at" to table: "registration_blocks"
CREATE INDEX "registrationblock_kind_value_hash_lifted_at" ON "registration_blocks" ("kind", "value_hash", "lifted_at");
