-- modify "brands" table
ALTER TABLE "brands" ADD COLUMN "selling_enabled" boolean NOT NULL DEFAULT false;
-- modify "stores" table
ALTER TABLE "stores" ADD COLUMN "channel" character varying NOT NULL DEFAULT 'store';
UPDATE "brands" SET "selling_enabled" = true WHERE "id" IN (SELECT "brand_id" FROM "stores" WHERE "brand_id" IS NOT NULL AND "has_official_badge");
GRANT SELECT ("channel") ON "stores" TO nantty_readers;
GRANT SELECT ("id", "account_id", "status", "created_at") ON "seller_applications" TO nantty_readers;
