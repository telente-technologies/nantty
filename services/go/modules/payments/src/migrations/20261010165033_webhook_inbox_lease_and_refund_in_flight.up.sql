-- modify "payment_intents" table
ALTER TABLE "payment_intents" ADD CONSTRAINT "payment_intents_refund_capacity" CHECK ((refund_in_flight_minor >= 0) AND ((refunded_minor + refund_in_flight_minor) <= amount_minor)), ADD COLUMN "refund_in_flight_minor" bigint NOT NULL DEFAULT 0, ADD COLUMN "saved_card_charge_started_at" timestamptz NULL;
-- modify "webhook_events" table
ALTER TABLE "webhook_events" ADD COLUMN "next_attempt_at" timestamptz NULL, ADD COLUMN "locked_until" timestamptz NULL, ADD COLUMN "lease_token" character varying NOT NULL DEFAULT '', ADD COLUMN "dead_lettered_at" timestamptz NULL;
-- create index "webhookevent_due" to table: "webhook_events"
CREATE INDEX "webhookevent_due" ON "webhook_events" ("next_attempt_at") WHERE ((processed_at IS NULL) AND (dead_lettered_at IS NULL));
-- backfill: refunded_minor now counts succeeded refunds only; open requests move to refund_in_flight_minor and failed ones release capacity
UPDATE "payment_intents" AS "intent" SET "refunded_minor" = "totals"."succeeded", "refund_in_flight_minor" = "totals"."open"
FROM (
  SELECT "payment_intent_id",
    COALESCE(SUM("amount_minor") FILTER (WHERE "status" = 'succeeded'), 0) AS "succeeded",
    COALESCE(SUM("amount_minor") FILTER (WHERE "status" IN ('pending', 'processing', 'awaiting_bank_details')), 0) AS "open"
  FROM "payment_refunds" GROUP BY "payment_intent_id"
) AS "totals"
WHERE "intent"."id" = "totals"."payment_intent_id";
-- backfill: rows the old sweeper had given up on become dead letters instead of silently stuck
UPDATE "webhook_events" SET "dead_lettered_at" = now() WHERE "processed_at" IS NULL AND "attempt_count" >= 20;
