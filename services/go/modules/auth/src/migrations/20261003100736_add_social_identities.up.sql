-- create "social_identities" table
CREATE TABLE "social_identities" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "provider" character varying NOT NULL, "subject" character varying NOT NULL, "email" character varying NULL, "account_id" uuid NOT NULL, PRIMARY KEY ("id"), CONSTRAINT "social_identities_accounts_social_identities" FOREIGN KEY ("account_id") REFERENCES "accounts" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION);
-- create index "socialidentity_account_id" to table: "social_identities"
CREATE INDEX "socialidentity_account_id" ON "social_identities" ("account_id");
-- create index "socialidentity_provider_subject" to table: "social_identities"
CREATE UNIQUE INDEX "socialidentity_provider_subject" ON "social_identities" ("provider", "subject");
