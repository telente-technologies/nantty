-- create "creator_subscriptions" table
CREATE TABLE "creator_subscriptions" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "subscriber_id" character varying NOT NULL, "creator_id" character varying NOT NULL, "plan_id" character varying NOT NULL, "status" character varying NOT NULL DEFAULT 'pending', "amount_minor" bigint NOT NULL, "currency" character varying NOT NULL, "interval" character varying NOT NULL, "billing_authorization_id" character varying NOT NULL DEFAULT '', "current_period_start" timestamptz NULL, "current_period_end" timestamptz NULL, "next_charge_at" timestamptz NULL, "renewal_attempts" bigint NOT NULL DEFAULT 0, "last_error" character varying NOT NULL DEFAULT '', "updated_at" timestamptz NOT NULL, PRIMARY KEY ("id"));
-- create index "creator_subscriptions_next_charge_due" to table: "creator_subscriptions"
CREATE INDEX "creator_subscriptions_next_charge_due" ON "creator_subscriptions" ("next_charge_at") WHERE (next_charge_at IS NOT NULL);
-- create index "creatorsubscription_creator_id_status" to table: "creator_subscriptions"
CREATE INDEX "creatorsubscription_creator_id_status" ON "creator_subscriptions" ("creator_id", "status");
-- create index "creatorsubscription_status_current_period_end" to table: "creator_subscriptions"
CREATE INDEX "creatorsubscription_status_current_period_end" ON "creator_subscriptions" ("status", "current_period_end");
-- create index "creatorsubscription_subscriber_id_creator_id" to table: "creator_subscriptions"
CREATE INDEX "creatorsubscription_subscriber_id_creator_id" ON "creator_subscriptions" ("subscriber_id", "creator_id");
-- create "creator_subscription_charges" table
CREATE TABLE "creator_subscription_charges" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "subscription_id" character varying NOT NULL, "subscriber_id" character varying NOT NULL, "creator_id" character varying NOT NULL, "kind" character varying NOT NULL, "idempotency_key" character varying NOT NULL, "payment_reference" character varying NOT NULL DEFAULT '', "attempt_count" bigint NOT NULL DEFAULT 0, "amount_minor" bigint NOT NULL, "currency" character varying NOT NULL, "status" character varying NOT NULL DEFAULT 'pending', "provider_fee_minor" bigint NOT NULL DEFAULT 0, "creator_share_minor" bigint NOT NULL DEFAULT 0, "platform_share_minor" bigint NOT NULL DEFAULT 0, "period_start" timestamptz NULL, "failure_reason" character varying NOT NULL DEFAULT '', "paid_at" timestamptz NULL, "updated_at" timestamptz NOT NULL, PRIMARY KEY ("id"));
-- create index "creatorsubscriptioncharge_idempotency_key" to table: "creator_subscription_charges"
CREATE UNIQUE INDEX "creatorsubscriptioncharge_idempotency_key" ON "creator_subscription_charges" ("idempotency_key");
-- create index "creatorsubscriptioncharge_payment_reference" to table: "creator_subscription_charges"
CREATE INDEX "creatorsubscriptioncharge_payment_reference" ON "creator_subscription_charges" ("payment_reference");
-- create index "creatorsubscriptioncharge_subscription_id_created_at" to table: "creator_subscription_charges"
CREATE INDEX "creatorsubscriptioncharge_subscription_id_created_at" ON "creator_subscription_charges" ("subscription_id", "created_at");
-- create "creator_subscription_plans" table
CREATE TABLE "creator_subscription_plans" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "creator_id" character varying NOT NULL, "name" character varying NOT NULL, "description" character varying NOT NULL DEFAULT '', "amount_minor" bigint NOT NULL, "currency" character varying NOT NULL, "interval" character varying NOT NULL DEFAULT 'month', "benefits" jsonb NOT NULL, "active" boolean NOT NULL DEFAULT true, "updated_at" timestamptz NOT NULL, PRIMARY KEY ("id"));
-- create index "creatorsubscriptionplan_creator_id_created_at" to table: "creator_subscription_plans"
CREATE INDEX "creatorsubscriptionplan_creator_id_created_at" ON "creator_subscription_plans" ("creator_id", "created_at");
-- grant subscriber access reads to other services
DO $$ BEGIN EXECUTE format('GRANT USAGE ON SCHEMA %I TO zudomart_readers', current_schema()); END $$;
GRANT SELECT ("subscriber_id", "creator_id", "status", "current_period_end") ON "creator_subscriptions" TO zudomart_readers;
