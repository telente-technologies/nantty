-- reverse: create index "webhookevent_due" to table: "webhook_events"
DROP INDEX "webhookevent_due";
-- reverse: modify "webhook_events" table
ALTER TABLE "webhook_events" DROP COLUMN "dead_lettered_at", DROP COLUMN "lease_token", DROP COLUMN "locked_until", DROP COLUMN "next_attempt_at";
-- reverse: modify "payment_intents" table
ALTER TABLE "payment_intents" DROP COLUMN "saved_card_charge_started_at", DROP COLUMN "refund_in_flight_minor", DROP CONSTRAINT "payment_intents_refund_capacity";
