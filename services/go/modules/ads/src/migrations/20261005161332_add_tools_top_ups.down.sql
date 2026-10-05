-- reverse: create index "adtopup_reference" to table: "ad_top_ups"
DROP INDEX "adtopup_reference";
-- reverse: create index "adtopup_money_top_up_id" to table: "ad_top_ups"
DROP INDEX "adtopup_money_top_up_id";
-- reverse: create index "adtopup_account_id_created_at" to table: "ad_top_ups"
DROP INDEX "adtopup_account_id_created_at";
-- reverse: create "ad_top_ups" table
DROP TABLE "ad_top_ups";
-- reverse: create index "adexperiment_status_end_at" to table: "ad_experiments"
DROP INDEX "adexperiment_status_end_at";
-- reverse: create index "adexperiment_account_id_created_at" to table: "ad_experiments"
DROP INDEX "adexperiment_account_id_created_at";
-- reverse: create "ad_experiments" table
DROP TABLE "ad_experiments";
-- reverse: create index "adconversionevent_account_id_created_at" to table: "ad_conversion_events"
DROP INDEX "adconversionevent_account_id_created_at";
-- reverse: create index "ad_conversion_events_built_in" to table: "ad_conversion_events"
DROP INDEX "ad_conversion_events_built_in";
-- reverse: create "ad_conversion_events" table
DROP TABLE "ad_conversion_events";
-- reverse: create index "adautomatedrule_status_next_run_at" to table: "ad_automated_rules"
DROP INDEX "adautomatedrule_status_next_run_at";
-- reverse: create index "adautomatedrule_account_id_created_at" to table: "ad_automated_rules"
DROP INDEX "adautomatedrule_account_id_created_at";
-- reverse: create "ad_automated_rules" table
DROP TABLE "ad_automated_rules";
-- reverse: create index "adgroup_experiment_id" to table: "ad_groups"
DROP INDEX "adgroup_experiment_id";
-- reverse: modify "ad_groups" table
ALTER TABLE "ad_groups" DROP COLUMN "experiment_id";
