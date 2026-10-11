-- reverse: create index "linkedprofile_kind_profile_id" to table: "linked_profiles"
DROP INDEX "linkedprofile_kind_profile_id";
-- reverse: create index "linkedprofile_account_id_status" to table: "linked_profiles"
DROP INDEX "linkedprofile_account_id_status";
-- reverse: create index "linked_profile_store_or_business" to table: "linked_profiles"
DROP INDEX "linked_profile_store_or_business";
-- reverse: create index "linked_profile_one_kind_per_account" to table: "linked_profiles"
DROP INDEX "linked_profile_one_kind_per_account";
-- reverse: create "linked_profiles" table
DROP TABLE "linked_profiles";
-- reverse: modify "profiles" table
ALTER TABLE "profiles" DROP COLUMN "publishing_held";
