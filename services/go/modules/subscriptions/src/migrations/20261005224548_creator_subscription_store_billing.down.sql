-- reverse: create index "creator_subscriptions_store_original_transaction" to table: "creator_subscriptions"
DROP INDEX "creator_subscriptions_store_original_transaction";
-- reverse: modify "creator_subscriptions" table
ALTER TABLE "creator_subscriptions" DROP COLUMN "store_slot", DROP COLUMN "store_original_transaction_id", DROP COLUMN "store_product_id", DROP COLUMN "billing_channel";
-- reverse: modify "creator_subscription_charges" table
ALTER TABLE "creator_subscription_charges" DROP COLUMN "refunded_at";
