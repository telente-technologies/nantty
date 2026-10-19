-- reverse: modify "ads" table
ALTER TABLE "ads" DROP COLUMN "ad_category";
-- reverse: modify "ad_campaigns" table
ALTER TABLE "ad_campaigns" DROP COLUMN "ad_category";
