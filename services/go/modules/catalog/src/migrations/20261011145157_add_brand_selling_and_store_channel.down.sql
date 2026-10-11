-- reverse: modify "stores" table
ALTER TABLE "stores" DROP COLUMN "channel";
-- reverse: modify "brands" table
ALTER TABLE "brands" DROP COLUMN "selling_enabled";
