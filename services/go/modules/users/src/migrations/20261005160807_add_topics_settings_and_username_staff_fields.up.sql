-- modify "privacy_settings" table
ALTER TABLE "privacy_settings" ADD COLUMN "marketing_frequency" character varying NOT NULL DEFAULT 'weekly';
-- modify "profiles" table
ALTER TABLE "profiles" ADD COLUMN "language" character varying NOT NULL DEFAULT 'en', ADD COLUMN "push_notifications_enabled" boolean NOT NULL DEFAULT true;
-- modify "reserved_username_rules" table
ALTER TABLE "reserved_username_rules" ADD COLUMN "created_by_name" character varying NOT NULL DEFAULT '', ADD COLUMN "category" character varying NOT NULL DEFAULT '', ADD COLUMN "note" character varying NOT NULL DEFAULT '', ADD COLUMN "reason" character varying NOT NULL DEFAULT '';
-- modify "username_holds" table
ALTER TABLE "username_holds" ADD COLUMN "created_by_name" character varying NOT NULL DEFAULT '';
-- create "account_topics" table
CREATE TABLE "account_topics" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "account_id" uuid NOT NULL, "topic_id" character varying NOT NULL, PRIMARY KEY ("id"));
-- create index "accounttopic_account_id_topic_id" to table: "account_topics"
CREATE UNIQUE INDEX "accounttopic_account_id_topic_id" ON "account_topics" ("account_id", "topic_id");
-- create "topics" table
CREATE TABLE "topics" ("id" character varying NOT NULL, "name" character varying NOT NULL, "position" bigint NOT NULL DEFAULT 0, "active" boolean NOT NULL DEFAULT true, PRIMARY KEY ("id"));
