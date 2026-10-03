-- create "exchange_rate_revisions" table
CREATE TABLE "exchange_rate_revisions" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "currency" character varying NOT NULL, "usd_rate_e8" bigint NOT NULL, "set_by" character varying NOT NULL DEFAULT '', "reason" character varying NOT NULL DEFAULT '', "source" character varying NOT NULL, PRIMARY KEY ("id"));
-- create index "exchangeraterevision_currency_created_at" to table: "exchange_rate_revisions"
CREATE INDEX "exchangeraterevision_currency_created_at" ON "exchange_rate_revisions" ("currency", "created_at");
-- create "outbox_events" table
CREATE TABLE "outbox_events" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "event_type" character varying NOT NULL, "subject" character varying NOT NULL, "payload" jsonb NOT NULL, "published_at" timestamptz NULL, PRIMARY KEY ("id"));
-- create index "outboxevent_published_at_created_at" to table: "outbox_events"
CREATE INDEX "outboxevent_published_at_created_at" ON "outbox_events" ("published_at", "created_at");
