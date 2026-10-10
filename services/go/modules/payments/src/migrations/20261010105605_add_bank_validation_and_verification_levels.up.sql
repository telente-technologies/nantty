-- create "customer_validations" table
CREATE TABLE "customer_validations" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "user_id" character varying NOT NULL, "provider" character varying NOT NULL, "provider_customer_id" character varying NOT NULL DEFAULT '', "status" character varying NOT NULL DEFAULT 'pending', "bank_code" character varying NOT NULL DEFAULT '', "account_last4" character varying NOT NULL DEFAULT '', "failure_reason" character varying NOT NULL DEFAULT '', "requested_at" timestamptz NOT NULL, "decided_at" timestamptz NULL, "version" bigint NOT NULL DEFAULT 0, PRIMARY KEY ("id"));
-- create index "customervalidation_provider_provider_customer_id" to table: "customer_validations"
CREATE INDEX "customervalidation_provider_provider_customer_id" ON "customer_validations" ("provider", "provider_customer_id");
-- create index "customervalidation_user_id" to table: "customer_validations"
CREATE UNIQUE INDEX "customervalidation_user_id" ON "customer_validations" ("user_id");
-- create "verification_level_records" table
CREATE TABLE "verification_level_records" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "user_id" character varying NOT NULL, "level" bigint NOT NULL DEFAULT 0, "payout_verified" boolean NOT NULL DEFAULT false, "identity_verified" boolean NOT NULL DEFAULT false, "updated_at" timestamptz NOT NULL, PRIMARY KEY ("id"));
-- create index "verificationlevelrecord_user_id" to table: "verification_level_records"
CREATE UNIQUE INDEX "verificationlevelrecord_user_id" ON "verification_level_records" ("user_id");
