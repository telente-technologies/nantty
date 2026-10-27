-- reverse: reader grant on "seller_applications"
REVOKE SELECT ("id", "account_id", "status", "created_at") ON "seller_applications" FROM nantty_readers;
-- reverse: modify "stores" table
ALTER TABLE "stores" DROP COLUMN "channel";
-- reverse: modify "brands" table
ALTER TABLE "brands" DROP COLUMN "selling_enabled";
