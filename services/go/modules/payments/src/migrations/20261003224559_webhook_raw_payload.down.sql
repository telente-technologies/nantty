-- reverse: modify "webhook_events" table
ALTER TABLE "webhook_events" DROP COLUMN "raw_payload";
