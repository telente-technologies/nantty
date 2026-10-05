-- reverse: create index "storeauditentry_store_newest" to table: "store_audit_entries"
DROP INDEX "storeauditentry_store_newest";
-- reverse: create index "storeauditentry_store_id_actor_id_id" to table: "store_audit_entries"
DROP INDEX "storeauditentry_store_id_actor_id_id";
-- reverse: create "store_audit_entries" table
DROP TABLE "store_audit_entries";
-- reverse: modify "stores" table
ALTER TABLE "stores" DROP COLUMN "social_links", DROP COLUMN "opening_hours", DROP COLUMN "tagline", DROP COLUMN "notification_preferences", DROP COLUMN "policies", DROP COLUMN "prices_include_tax", DROP COLUMN "tax_rates", DROP COLUMN "contact_address", DROP COLUMN "contact_email", DROP COLUMN "contact_phone", DROP COLUMN "locale";
-- reverse: modify "store_members" table
ALTER TABLE "store_members" DROP COLUMN "last_active_at", DROP COLUMN "accepted_at", DROP COLUMN "invited_by_account_id", DROP COLUMN "location_ids";
