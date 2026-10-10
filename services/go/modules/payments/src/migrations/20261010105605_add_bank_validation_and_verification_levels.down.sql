-- reverse: create index "verificationlevelrecord_user_id" to table: "verification_level_records"
DROP INDEX "verificationlevelrecord_user_id";
-- reverse: create "verification_level_records" table
DROP TABLE "verification_level_records";
-- reverse: create index "customervalidation_user_id" to table: "customer_validations"
DROP INDEX "customervalidation_user_id";
-- reverse: create index "customervalidation_provider_provider_customer_id" to table: "customer_validations"
DROP INDEX "customervalidation_provider_provider_customer_id";
-- reverse: create "customer_validations" table
DROP TABLE "customer_validations";
