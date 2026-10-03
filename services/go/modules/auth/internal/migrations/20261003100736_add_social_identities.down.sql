-- reverse: create index "socialidentity_provider_subject" to table: "social_identities"
DROP INDEX "socialidentity_provider_subject";
-- reverse: create index "socialidentity_account_id" to table: "social_identities"
DROP INDEX "socialidentity_account_id";
-- reverse: create "social_identities" table
DROP TABLE "social_identities";
