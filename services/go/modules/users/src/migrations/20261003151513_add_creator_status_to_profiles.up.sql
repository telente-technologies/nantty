-- drop index "profile_one_creator_per_account" from table: "profiles"
DROP INDEX "profile_one_creator_per_account";
-- modify "profiles" table
ALTER TABLE "profiles" ADD COLUMN "creator_status" character varying NOT NULL DEFAULT 'none';
