-- reverse: create index "outboxevent_published_at_created_at" to table: "outbox_events"
DROP INDEX "outboxevent_published_at_created_at";
-- reverse: create "outbox_events" table
DROP TABLE "outbox_events";
-- reverse: create index "exchangeraterevision_currency_created_at" to table: "exchange_rate_revisions"
DROP INDEX "exchangeraterevision_currency_created_at";
-- reverse: create "exchange_rate_revisions" table
DROP TABLE "exchange_rate_revisions";
