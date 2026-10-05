-- reverse: create index "storedailytraffic_store_id_day" to table: "store_daily_traffics"
DROP INDEX "storedailytraffic_store_id_day";
-- reverse: create "store_daily_traffics" table
DROP TABLE "store_daily_traffics";
-- reverse: create index "productdailyview_store_id_day" to table: "product_daily_views"
DROP INDEX "productdailyview_store_id_day";
-- reverse: create index "productdailyview_product_id_day" to table: "product_daily_views"
DROP INDEX "productdailyview_product_id_day";
-- reverse: create "product_daily_views" table
DROP TABLE "product_daily_views";
