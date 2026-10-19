-- modify "ad_campaigns" table
ALTER TABLE "ad_campaigns" ADD COLUMN "ad_category" character varying NOT NULL DEFAULT 'general';
-- modify "ads" table
ALTER TABLE "ads" ADD COLUMN "ad_category" character varying NOT NULL DEFAULT '';
