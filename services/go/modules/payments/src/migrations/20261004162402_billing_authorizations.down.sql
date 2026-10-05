-- reverse: create index "billingauthorization_user_id_created_at" to table: "billing_authorizations"
DROP INDEX "billingauthorization_user_id_created_at";
-- reverse: create index "billingauthorization_user_id_card_fingerprint_hash" to table: "billing_authorizations"
DROP INDEX "billingauthorization_user_id_card_fingerprint_hash";
-- reverse: create "billing_authorizations" table
DROP TABLE "billing_authorizations";
