-- reverse: create index "agegaterefusal_kind_value_hash_expires_at" to table: "age_gate_refusals"
DROP INDEX "agegaterefusal_kind_value_hash_expires_at";
-- reverse: create index "agegaterefusal_expires_at" to table: "age_gate_refusals"
DROP INDEX "agegaterefusal_expires_at";
-- reverse: create "age_gate_refusals" table
DROP TABLE "age_gate_refusals";
