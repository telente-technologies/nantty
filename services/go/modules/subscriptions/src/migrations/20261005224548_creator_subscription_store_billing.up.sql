-- modify "creator_subscription_charges" table
ALTER TABLE "creator_subscription_charges" ADD COLUMN "refunded_at" timestamptz NULL;
-- modify "creator_subscriptions" table
ALTER TABLE "creator_subscriptions" ADD COLUMN "billing_channel" character varying NOT NULL DEFAULT 'web', ADD COLUMN "store_product_id" character varying NOT NULL DEFAULT '', ADD COLUMN "store_original_transaction_id" character varying NOT NULL DEFAULT '', ADD COLUMN "store_slot" bigint NOT NULL DEFAULT 0;
-- create index "creator_subscriptions_store_original_transaction" to table: "creator_subscriptions"
CREATE INDEX "creator_subscriptions_store_original_transaction" ON "creator_subscriptions" ("store_original_transaction_id") WHERE ((store_original_transaction_id)::text <> ''::text);
