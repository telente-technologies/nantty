-- reverse: create "profile_categories" table
DROP TABLE "profile_categories";
-- reverse: create index "profile_one_personal_per_account" to table: "profiles"
DROP INDEX "profile_one_personal_per_account";
-- reverse: create index "profile_one_creator_per_account" to table: "profiles"
DROP INDEX "profile_one_creator_per_account";
-- reverse: create index "profile_handle" to table: "profiles"
DROP INDEX "profile_handle";
-- reverse: create index "profile_account_id" to table: "profiles"
DROP INDEX "profile_account_id";
-- reverse: create "profiles" table
DROP TABLE "profiles";
-- reverse: create index "usernamehold_username" to table: "username_holds"
DROP INDEX "usernamehold_username";
-- reverse: create "username_holds" table
DROP TABLE "username_holds";
-- reverse: create index "usernamechange_account_id_created_at" to table: "username_changes"
DROP INDEX "usernamechange_account_id_created_at";
-- reverse: create "username_changes" table
DROP TABLE "username_changes";
-- reverse: create index "reservedusernamerule_term_match_kind" to table: "reserved_username_rules"
DROP INDEX "reservedusernamerule_term_match_kind";
-- reverse: create "reserved_username_rules" table
DROP TABLE "reserved_username_rules";
-- reverse: create index "outboxevent_published_at_created_at" to table: "outbox_events"
DROP INDEX "outboxevent_published_at_created_at";
-- reverse: create "outbox_events" table
DROP TABLE "outbox_events";
-- reverse: create index "businesscategory_slug" to table: "business_categories"
DROP INDEX "businesscategory_slug";
-- reverse: create index "businesscategory_parent_id" to table: "business_categories"
DROP INDEX "businesscategory_parent_id";
-- reverse: create "business_categories" table
DROP TABLE "business_categories";
-- reverse: create index "actingprofile_account_id" to table: "acting_profiles"
DROP INDEX "actingprofile_account_id";
-- reverse: create "acting_profiles" table
DROP TABLE "acting_profiles";
