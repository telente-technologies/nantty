-- create "billing_authorizations" table
CREATE TABLE "billing_authorizations" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "user_id" character varying NOT NULL, "provider" character varying NOT NULL, "provider_customer_id" character varying NOT NULL DEFAULT '', "sealed_authorization" bytea NOT NULL, "card_fingerprint_hash" character varying NOT NULL, "card_brand" character varying NOT NULL DEFAULT '', "card_last4" character varying NOT NULL DEFAULT '', "card_expiry_month" bigint NOT NULL DEFAULT 0, "card_expiry_year" bigint NOT NULL DEFAULT 0, "revoked_at" timestamptz NULL, "last_used_at" timestamptz NULL, PRIMARY KEY ("id"));
-- create index "billingauthorization_user_id_card_fingerprint_hash" to table: "billing_authorizations"
CREATE UNIQUE INDEX "billingauthorization_user_id_card_fingerprint_hash" ON "billing_authorizations" ("user_id", "card_fingerprint_hash");
-- create index "billingauthorization_user_id_created_at" to table: "billing_authorizations"
CREATE INDEX "billingauthorization_user_id_created_at" ON "billing_authorizations" ("user_id", "created_at");
