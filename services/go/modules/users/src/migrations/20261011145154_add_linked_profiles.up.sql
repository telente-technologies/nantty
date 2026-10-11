-- modify "profiles" table
ALTER TABLE "profiles" ADD COLUMN "publishing_held" boolean NOT NULL DEFAULT false;
-- create "linked_profiles" table
CREATE TABLE "linked_profiles" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "account_id" uuid NOT NULL, "kind" character varying NOT NULL, "profile_id" uuid NOT NULL, "store_id" uuid NULL, "status" character varying NOT NULL DEFAULT 'active', "hold_reason" character varying NULL, "updated_at" timestamptz NOT NULL, PRIMARY KEY ("id"));
-- create index "linked_profile_one_kind_per_account" to table: "linked_profiles"
CREATE UNIQUE INDEX "linked_profile_one_kind_per_account" ON "linked_profiles" ("account_id", "kind") WHERE ((status)::text = 'active'::text);
-- create index "linked_profile_store_or_business" to table: "linked_profiles"
CREATE UNIQUE INDEX "linked_profile_store_or_business" ON "linked_profiles" ("account_id") WHERE (((status)::text = 'active'::text) AND ((kind)::text = ANY ((ARRAY['store'::character varying, 'business'::character varying])::text[])));
-- create index "linkedprofile_account_id_status" to table: "linked_profiles"
CREATE INDEX "linkedprofile_account_id_status" ON "linked_profiles" ("account_id", "status");
-- create index "linkedprofile_kind_profile_id" to table: "linked_profiles"
CREATE UNIQUE INDEX "linkedprofile_kind_profile_id" ON "linked_profiles" ("kind", "profile_id");
GRANT SELECT ("publishing_held") ON "profiles" TO zudomart_readers;
