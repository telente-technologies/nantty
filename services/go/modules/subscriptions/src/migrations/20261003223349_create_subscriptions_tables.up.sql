-- create "idempotent_requests" table
CREATE TABLE "idempotent_requests" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "scope" character varying NOT NULL, "key" character varying NOT NULL, "request_hash" character varying NOT NULL, "response_body" jsonb NULL, PRIMARY KEY ("id"));
-- create index "idempotentrequest_scope_key" to table: "idempotent_requests"
CREATE UNIQUE INDEX "idempotentrequest_scope_key" ON "idempotent_requests" ("scope", "key");
-- create "outbox_events" table
CREATE TABLE "outbox_events" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "event_type" character varying NOT NULL, "subject" character varying NOT NULL, "payload" jsonb NOT NULL, "published_at" timestamptz NULL, "attempt_count" bigint NOT NULL DEFAULT 0, "next_attempt_at" timestamptz NULL, "last_error" character varying NOT NULL DEFAULT '', "dead_lettered_at" timestamptz NULL, PRIMARY KEY ("id"));
-- create index "outboxevent_published_at_dead_lettered_at_created_at" to table: "outbox_events"
CREATE INDEX "outboxevent_published_at_dead_lettered_at_created_at" ON "outbox_events" ("published_at", "dead_lettered_at", "created_at");
-- create "plan_prices" table
CREATE TABLE "plan_prices" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "plan_code" character varying NOT NULL, "country_code" character varying NOT NULL, "currency" character varying NOT NULL, "monthly_amount_minor" bigint NOT NULL, "active" boolean NOT NULL DEFAULT true, "updated_by_staff_id" character varying NOT NULL DEFAULT '', "updated_at" timestamptz NOT NULL, PRIMARY KEY ("id"));
-- create index "planprice_plan_code_country_code" to table: "plan_prices"
CREATE UNIQUE INDEX "planprice_plan_code_country_code" ON "plan_prices" ("plan_code", "country_code");
-- create "provider_plans" table
CREATE TABLE "provider_plans" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "plan_code" character varying NOT NULL, "interval" character varying NOT NULL, "amount_minor" bigint NOT NULL, "currency" character varying NOT NULL, "provider_plan_code" character varying NOT NULL, PRIMARY KEY ("id"));
-- create index "providerplan_plan_code_interval_amount_minor_currency" to table: "provider_plans"
CREATE UNIQUE INDEX "providerplan_plan_code_interval_amount_minor_currency" ON "provider_plans" ("plan_code", "interval", "amount_minor", "currency");
-- create "subscriptions" table
CREATE TABLE "subscriptions" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "profile_id" character varying NOT NULL, "profile_type" character varying NOT NULL, "owner_user_id" character varying NOT NULL, "plan_code" character varying NOT NULL, "interval" character varying NOT NULL, "channel" character varying NOT NULL, "status" character varying NOT NULL DEFAULT 'pending', "list_amount_minor" bigint NOT NULL, "amount_minor" bigint NOT NULL, "currency" character varying NOT NULL, "discount_kind" character varying NOT NULL DEFAULT 'none', "discount_bps" bigint NOT NULL DEFAULT 0, "with_trial" boolean NOT NULL DEFAULT false, "trial_days" bigint NOT NULL DEFAULT 0, "trial_ends_at" timestamptz NULL, "current_period_ends_at" timestamptz NULL, "grace_ends_at" timestamptz NULL, "bundle_lapses_at" timestamptz NULL, "cancel_at_period_end" boolean NOT NULL DEFAULT false, "provider_plan_code" character varying NOT NULL DEFAULT '', "provider_customer_id" character varying NOT NULL DEFAULT '', "billing_reference" character varying NOT NULL DEFAULT '', "store_original_transaction_id" character varying NOT NULL DEFAULT '', "card_label" character varying NOT NULL DEFAULT '', "activation_pending" boolean NOT NULL DEFAULT false, "last_error" character varying NOT NULL DEFAULT '', "version" bigint NOT NULL DEFAULT 0, "updated_at" timestamptz NOT NULL, PRIMARY KEY ("id"));
-- create index "subscription_billing_reference" to table: "subscriptions"
CREATE INDEX "subscription_billing_reference" ON "subscriptions" ("billing_reference");
-- create index "subscription_owner_user_id_status" to table: "subscriptions"
CREATE INDEX "subscription_owner_user_id_status" ON "subscriptions" ("owner_user_id", "status");
-- create index "subscription_status_trial_ends_at" to table: "subscriptions"
CREATE INDEX "subscription_status_trial_ends_at" ON "subscriptions" ("status", "trial_ends_at");
-- create index "subscription_store_original_transaction_id" to table: "subscriptions"
CREATE INDEX "subscription_store_original_transaction_id" ON "subscriptions" ("store_original_transaction_id");
-- create index "subscriptions_activation_pending" to table: "subscriptions"
CREATE INDEX "subscriptions_activation_pending" ON "subscriptions" ("activation_pending") WHERE activation_pending;
-- create index "subscriptions_live_per_profile" to table: "subscriptions"
CREATE UNIQUE INDEX "subscriptions_live_per_profile" ON "subscriptions" ("profile_id", "plan_code") WHERE ((status)::text = ANY ((ARRAY['pending'::character varying, 'awaiting_card'::character varying, 'trialing'::character varying, 'active'::character varying, 'past_due'::character varying, 'grace'::character varying])::text[]));
-- create "subscription_reminders" table
CREATE TABLE "subscription_reminders" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "subscription_id" character varying NOT NULL, "kind" character varying NOT NULL, "days_before" bigint NOT NULL, "due_at" timestamptz NOT NULL, "sent_at" timestamptz NULL, PRIMARY KEY ("id"));
-- create index "subscription_reminders_due" to table: "subscription_reminders"
CREATE INDEX "subscription_reminders_due" ON "subscription_reminders" ("due_at") WHERE (sent_at IS NULL);
-- create index "subscriptionreminder_subscription_id_kind_days_before" to table: "subscription_reminders"
CREATE UNIQUE INDEX "subscriptionreminder_subscription_id_kind_days_before" ON "subscription_reminders" ("subscription_id", "kind", "days_before");
-- create "trial_claims" table
CREATE TABLE "trial_claims" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "kind" character varying NOT NULL, "fingerprint_hash" character varying NOT NULL, "subscription_id" character varying NOT NULL, "owner_user_id" character varying NOT NULL, PRIMARY KEY ("id"));
-- create index "trialclaim_kind_fingerprint_hash" to table: "trial_claims"
CREATE UNIQUE INDEX "trialclaim_kind_fingerprint_hash" ON "trial_claims" ("kind", "fingerprint_hash");
