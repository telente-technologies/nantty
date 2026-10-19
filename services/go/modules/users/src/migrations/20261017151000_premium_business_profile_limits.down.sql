-- reverse: create index "linked_profile_one_store_per_account" to table: "linked_profiles"
DROP INDEX "linked_profile_one_store_per_account";
-- reverse: drop index "linked_profile_store_or_business" from table: "linked_profiles"
CREATE UNIQUE INDEX "linked_profile_store_or_business" ON "linked_profiles" ("account_id") WHERE (((status)::text = 'active'::text) AND ((kind)::text = ANY ((ARRAY['store'::character varying, 'business'::character varying])::text[])));
-- reverse: drop index "linked_profile_one_kind_per_account" from table: "linked_profiles"
CREATE UNIQUE INDEX "linked_profile_one_kind_per_account" ON "linked_profiles" ("account_id", "kind") WHERE ((status)::text = 'active'::text);
