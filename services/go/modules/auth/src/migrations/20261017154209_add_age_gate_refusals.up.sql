-- create "age_gate_refusals" table
CREATE TABLE "age_gate_refusals" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "kind" character varying NOT NULL, "value_hash" character varying NOT NULL, "expires_at" timestamptz NOT NULL, PRIMARY KEY ("id"));
-- create index "agegaterefusal_expires_at" to table: "age_gate_refusals"
CREATE INDEX "agegaterefusal_expires_at" ON "age_gate_refusals" ("expires_at");
-- create index "agegaterefusal_kind_value_hash_expires_at" to table: "age_gate_refusals"
CREATE INDEX "agegaterefusal_kind_value_hash_expires_at" ON "age_gate_refusals" ("kind", "value_hash", "expires_at");
