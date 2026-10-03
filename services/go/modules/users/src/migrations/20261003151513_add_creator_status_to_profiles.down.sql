-- reverse: modify "profiles" table
ALTER TABLE "profiles" DROP COLUMN "creator_status";
-- reverse: drop index "profile_one_creator_per_account" from table: "profiles"
CREATE UNIQUE INDEX "profile_one_creator_per_account" ON "profiles" ("account_id") WHERE ((kind)::text = 'creator'::text);
