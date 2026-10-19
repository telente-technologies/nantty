-- drop index "linked_profile_one_kind_per_account" from table: "linked_profiles"
DROP INDEX "linked_profile_one_kind_per_account";
-- drop index "linked_profile_store_or_business" from table: "linked_profiles"
DROP INDEX "linked_profile_store_or_business";
-- create index "linked_profile_one_store_per_account" to table: "linked_profiles"
CREATE UNIQUE INDEX "linked_profile_one_store_per_account" ON "linked_profiles" ("account_id") WHERE (((status)::text = 'active'::text) AND (((kind)::text = 'store'::text) OR (store_id IS NOT NULL)));
