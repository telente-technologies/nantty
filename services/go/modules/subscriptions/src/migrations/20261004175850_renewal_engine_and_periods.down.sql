-- reverse: create index "subscriptionperiod_subscription_id_period_starts_at" to table: "subscription_periods"
DROP INDEX "subscriptionperiod_subscription_id_period_starts_at";
-- reverse: create index "subscriptionperiod_payment_reference" to table: "subscription_periods"
DROP INDEX "subscriptionperiod_payment_reference";
-- reverse: create index "subscriptionperiod_idempotency_key" to table: "subscription_periods"
DROP INDEX "subscriptionperiod_idempotency_key";
-- reverse: create "subscription_periods" table
DROP TABLE "subscription_periods";
-- reverse: create index "subscriptions_next_charge_due" to table: "subscriptions"
DROP INDEX "subscriptions_next_charge_due";
-- reverse: modify "subscriptions" table
ALTER TABLE "subscriptions" DROP COLUMN "ended_reason", DROP COLUMN "card_expiry_noticed_at", DROP COLUMN "card_expiry_year", DROP COLUMN "card_expiry_month", DROP COLUMN "price_effective_at", DROP COLUMN "price_notice_amount_minor", DROP COLUMN "period_price_minor", DROP COLUMN "pending_interval", DROP COLUMN "pending_plan_code", DROP COLUMN "credit_minor", DROP COLUMN "checkmark_included", DROP COLUMN "dunning_due_at", DROP COLUMN "dunning_attempts", DROP COLUMN "next_charge_at", DROP COLUMN "billing_anchor_at", DROP COLUMN "billing_authorization_id";
