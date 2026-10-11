-- modify "ad_groups" table
ALTER TABLE "ad_groups" ADD COLUMN "experiment_id" uuid NULL;
-- create index "adgroup_experiment_id" to table: "ad_groups"
CREATE INDEX "adgroup_experiment_id" ON "ad_groups" ("experiment_id");
-- create "ad_automated_rules" table
CREATE TABLE "ad_automated_rules" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "account_id" uuid NOT NULL, "name" character varying NOT NULL, "status" character varying NOT NULL DEFAULT 'active', "level" character varying NOT NULL, "target_ids" jsonb NOT NULL, "conditions" jsonb NOT NULL, "action_type" character varying NOT NULL, "action_percent" bigint NULL, "check_every_minutes" bigint NOT NULL DEFAULT 60, "last_run_at" timestamptz NULL, "last_triggered_at" timestamptz NULL, "trigger_count" bigint NOT NULL DEFAULT 0, "next_run_at" timestamptz NOT NULL, "created_by_user_id" uuid NOT NULL, "updated_at" timestamptz NOT NULL, PRIMARY KEY ("id"));
-- create index "adautomatedrule_account_id_created_at" to table: "ad_automated_rules"
CREATE INDEX "adautomatedrule_account_id_created_at" ON "ad_automated_rules" ("account_id", "created_at");
-- create index "adautomatedrule_status_next_run_at" to table: "ad_automated_rules"
CREATE INDEX "adautomatedrule_status_next_run_at" ON "ad_automated_rules" ("status", "next_run_at");
-- create "ad_conversion_events" table
CREATE TABLE "ad_conversion_events" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "account_id" uuid NOT NULL, "name" character varying NOT NULL, "event_type" character varying NOT NULL, "store_id" character varying NOT NULL, "store_name" character varying NOT NULL DEFAULT '', "is_built_in" boolean NOT NULL DEFAULT false, "status" character varying NOT NULL DEFAULT 'active', "tracks_value" boolean NOT NULL DEFAULT false, "updated_at" timestamptz NOT NULL, PRIMARY KEY ("id"));
-- create index "ad_conversion_events_built_in" to table: "ad_conversion_events"
CREATE UNIQUE INDEX "ad_conversion_events_built_in" ON "ad_conversion_events" ("account_id", "store_id", "event_type") WHERE is_built_in;
-- create index "adconversionevent_account_id_created_at" to table: "ad_conversion_events"
CREATE INDEX "adconversionevent_account_id_created_at" ON "ad_conversion_events" ("account_id", "created_at");
-- create "ad_experiments" table
CREATE TABLE "ad_experiments" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "account_id" uuid NOT NULL, "campaign_id" uuid NOT NULL, "name" character varying NOT NULL, "variable" character varying NOT NULL, "metric" character varying NOT NULL, "status" character varying NOT NULL DEFAULT 'draft', "arms" jsonb NOT NULL, "start_at" timestamptz NOT NULL, "end_at" timestamptz NOT NULL, "result" jsonb NULL, "created_by_user_id" uuid NOT NULL, "updated_at" timestamptz NOT NULL, PRIMARY KEY ("id"));
-- create index "adexperiment_account_id_created_at" to table: "ad_experiments"
CREATE INDEX "adexperiment_account_id_created_at" ON "ad_experiments" ("account_id", "created_at");
-- create index "adexperiment_status_end_at" to table: "ad_experiments"
CREATE INDEX "adexperiment_status_end_at" ON "ad_experiments" ("status", "end_at");
-- create "ad_top_ups" table
CREATE TABLE "ad_top_ups" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "account_id" uuid NOT NULL, "money_top_up_id" character varying NOT NULL, "reference" character varying NOT NULL, "amount_minor" bigint NOT NULL, "currency" character varying NOT NULL, "provider" character varying NOT NULL DEFAULT 'flutterwave', "status" character varying NOT NULL DEFAULT 'pending', "failure_reason" character varying NOT NULL DEFAULT '', "authorization_url" character varying NOT NULL DEFAULT '', "requested_by_user_id" uuid NOT NULL, "completed_at" timestamptz NULL, "updated_at" timestamptz NOT NULL, PRIMARY KEY ("id"));
-- create index "adtopup_account_id_created_at" to table: "ad_top_ups"
CREATE INDEX "adtopup_account_id_created_at" ON "ad_top_ups" ("account_id", "created_at");
-- create index "adtopup_money_top_up_id" to table: "ad_top_ups"
CREATE UNIQUE INDEX "adtopup_money_top_up_id" ON "ad_top_ups" ("money_top_up_id");
-- create index "adtopup_reference" to table: "ad_top_ups"
CREATE UNIQUE INDEX "adtopup_reference" ON "ad_top_ups" ("reference");
