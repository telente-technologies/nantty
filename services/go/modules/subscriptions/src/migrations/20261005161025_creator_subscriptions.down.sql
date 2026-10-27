REVOKE SELECT ON "creator_subscriptions" FROM nantty_readers;
-- reverse: create index "creatorsubscriptionplan_creator_id_created_at" to table: "creator_subscription_plans"
DROP INDEX "creatorsubscriptionplan_creator_id_created_at";
-- reverse: create "creator_subscription_plans" table
DROP TABLE "creator_subscription_plans";
-- reverse: create index "creatorsubscriptioncharge_subscription_id_created_at" to table: "creator_subscription_charges"
DROP INDEX "creatorsubscriptioncharge_subscription_id_created_at";
-- reverse: create index "creatorsubscriptioncharge_payment_reference" to table: "creator_subscription_charges"
DROP INDEX "creatorsubscriptioncharge_payment_reference";
-- reverse: create index "creatorsubscriptioncharge_idempotency_key" to table: "creator_subscription_charges"
DROP INDEX "creatorsubscriptioncharge_idempotency_key";
-- reverse: create "creator_subscription_charges" table
DROP TABLE "creator_subscription_charges";
-- reverse: create index "creatorsubscription_subscriber_id_creator_id" to table: "creator_subscriptions"
DROP INDEX "creatorsubscription_subscriber_id_creator_id";
-- reverse: create index "creatorsubscription_status_current_period_end" to table: "creator_subscriptions"
DROP INDEX "creatorsubscription_status_current_period_end";
-- reverse: create index "creatorsubscription_creator_id_status" to table: "creator_subscriptions"
DROP INDEX "creatorsubscription_creator_id_status";
-- reverse: create index "creator_subscriptions_next_charge_due" to table: "creator_subscriptions"
DROP INDEX "creator_subscriptions_next_charge_due";
-- reverse: create "creator_subscriptions" table
DROP TABLE "creator_subscriptions";
