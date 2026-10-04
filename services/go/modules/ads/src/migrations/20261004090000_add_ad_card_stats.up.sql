-- create "ad_card_stats_dailies" table
CREATE TABLE "ad_card_stats_dailies" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "day" character varying NOT NULL, "account_id" uuid NOT NULL, "ad_id" uuid NOT NULL, "card_index" bigint NOT NULL, "impressions" bigint NOT NULL DEFAULT 0, "clicks" bigint NOT NULL DEFAULT 0, PRIMARY KEY ("id"));
-- create index "adcardstatsdaily_ad_id_day" to table: "ad_card_stats_dailies"
CREATE INDEX "adcardstatsdaily_ad_id_day" ON "ad_card_stats_dailies" ("ad_id", "day");
-- create index "adcardstatsdaily_day_ad_id_card_index" to table: "ad_card_stats_dailies"
CREATE UNIQUE INDEX "adcardstatsdaily_day_ad_id_card_index" ON "ad_card_stats_dailies" ("day", "ad_id", "card_index");
