-- reverse: create index "trialclaim_kind_fingerprint_hash" to table: "trial_claims"
DROP INDEX "trialclaim_kind_fingerprint_hash";
-- reverse: create "trial_claims" table
DROP TABLE "trial_claims";
-- reverse: create index "subscriptionreminder_subscription_id_kind_days_before" to table: "subscription_reminders"
DROP INDEX "subscriptionreminder_subscription_id_kind_days_before";
-- reverse: create index "subscription_reminders_due" to table: "subscription_reminders"
DROP INDEX "subscription_reminders_due";
-- reverse: create "subscription_reminders" table
DROP TABLE "subscription_reminders";
-- reverse: create index "subscriptions_live_per_profile" to table: "subscriptions"
DROP INDEX "subscriptions_live_per_profile";
-- reverse: create index "subscriptions_activation_pending" to table: "subscriptions"
DROP INDEX "subscriptions_activation_pending";
-- reverse: create index "subscription_store_original_transaction_id" to table: "subscriptions"
DROP INDEX "subscription_store_original_transaction_id";
-- reverse: create index "subscription_status_trial_ends_at" to table: "subscriptions"
DROP INDEX "subscription_status_trial_ends_at";
-- reverse: create index "subscription_owner_user_id_status" to table: "subscriptions"
DROP INDEX "subscription_owner_user_id_status";
-- reverse: create index "subscription_billing_reference" to table: "subscriptions"
DROP INDEX "subscription_billing_reference";
-- reverse: create "subscriptions" table
DROP TABLE "subscriptions";
-- reverse: create index "providerplan_plan_code_interval_amount_minor_currency" to table: "provider_plans"
DROP INDEX "providerplan_plan_code_interval_amount_minor_currency";
-- reverse: create "provider_plans" table
DROP TABLE "provider_plans";
-- reverse: create index "planprice_plan_code_country_code" to table: "plan_prices"
DROP INDEX "planprice_plan_code_country_code";
-- reverse: create "plan_prices" table
DROP TABLE "plan_prices";
-- reverse: create index "outboxevent_published_at_dead_lettered_at_created_at" to table: "outbox_events"
DROP INDEX "outboxevent_published_at_dead_lettered_at_created_at";
-- reverse: create "outbox_events" table
DROP TABLE "outbox_events";
-- reverse: create index "idempotentrequest_scope_key" to table: "idempotent_requests"
DROP INDEX "idempotentrequest_scope_key";
-- reverse: create "idempotent_requests" table
DROP TABLE "idempotent_requests";
