-- reverse: create "topics" table
DROP TABLE "topics";
-- reverse: create index "accounttopic_account_id_topic_id" to table: "account_topics"
DROP INDEX "accounttopic_account_id_topic_id";
-- reverse: create "account_topics" table
DROP TABLE "account_topics";
-- reverse: modify "username_holds" table
ALTER TABLE "username_holds" DROP COLUMN "created_by_name";
-- reverse: modify "reserved_username_rules" table
ALTER TABLE "reserved_username_rules" DROP COLUMN "reason", DROP COLUMN "note", DROP COLUMN "category", DROP COLUMN "created_by_name";
-- reverse: modify "profiles" table
ALTER TABLE "profiles" DROP COLUMN "push_notifications_enabled", DROP COLUMN "language";
-- reverse: modify "privacy_settings" table
ALTER TABLE "privacy_settings" DROP COLUMN "marketing_frequency";
