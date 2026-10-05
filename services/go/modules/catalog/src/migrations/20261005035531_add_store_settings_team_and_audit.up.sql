-- modify "store_members" table
ALTER TABLE "store_members" ADD COLUMN "location_ids" jsonb NULL, ADD COLUMN "invited_by_account_id" uuid NULL, ADD COLUMN "accepted_at" timestamptz NULL, ADD COLUMN "last_active_at" timestamptz NULL;
-- modify "stores" table
ALTER TABLE "stores" ADD COLUMN "locale" character varying NOT NULL DEFAULT 'en-NG', ADD COLUMN "contact_phone" character varying NOT NULL DEFAULT '', ADD COLUMN "contact_email" character varying NOT NULL DEFAULT '', ADD COLUMN "contact_address" character varying NOT NULL DEFAULT '', ADD COLUMN "tax_rates" jsonb NULL, ADD COLUMN "prices_include_tax" boolean NOT NULL DEFAULT false, ADD COLUMN "policies" jsonb NULL, ADD COLUMN "notification_preferences" jsonb NULL, ADD COLUMN "tagline" character varying NOT NULL DEFAULT '', ADD COLUMN "opening_hours" jsonb NULL, ADD COLUMN "social_links" jsonb NULL;
-- create "store_audit_entries" table
CREATE TABLE "store_audit_entries" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "store_id" uuid NOT NULL, "actor_id" character varying NOT NULL, "actor_name" character varying NOT NULL DEFAULT '', "actor_role" character varying NOT NULL DEFAULT '', "action" character varying NOT NULL, "target_type" character varying NOT NULL DEFAULT '', "target_id" character varying NULL, "summary" character varying NOT NULL DEFAULT '', "ip_address" character varying NULL, PRIMARY KEY ("id"));
-- create index "storeauditentry_store_id_actor_id_id" to table: "store_audit_entries"
CREATE INDEX "storeauditentry_store_id_actor_id_id" ON "store_audit_entries" ("store_id", "actor_id", "id");
-- create index "storeauditentry_store_newest" to table: "store_audit_entries"
CREATE INDEX "storeauditentry_store_newest" ON "store_audit_entries" ("store_id", "id" DESC);
