-- Add government billing fields, paused status uniqueness, and Black USD monthly pricing reconciliation.
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "paused_reason" character varying NOT NULL DEFAULT '';
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "black_application_id" character varying NOT NULL DEFAULT '';
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "verified_jurisdiction_country" character varying(2) NOT NULL DEFAULT '';
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "terms_accepted_at" timestamptz NULL;
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "recurring_consent_at" timestamptz NULL;

DROP INDEX IF EXISTS "subscriptions_live_per_profile";
CREATE UNIQUE INDEX "subscriptions_live_per_profile" ON "subscriptions" ("profile_id", "plan_code")
    WHERE ((status)::text = ANY ((ARRAY['pending'::character varying, 'awaiting_card'::character varying, 'trialing'::character varying, 'active'::character varying, 'past_due'::character varying, 'grace'::character varying, 'paused'::character varying])::text[]));

CREATE TABLE IF NOT EXISTS "black_billing_events" (
    "id" uuid NOT NULL,
    "subscription_id" character varying NOT NULL DEFAULT '',
    "application_id" character varying NOT NULL DEFAULT '',
    "profile_id" character varying NOT NULL,
    "owner_user_id" character varying NOT NULL,
    "event_kind" character varying NOT NULL,
    "actor_kind" character varying NOT NULL,
    "actor_id" character varying NOT NULL DEFAULT '',
    "summary" text NOT NULL,
    "metadata" jsonb NOT NULL DEFAULT '{}',
    "created_at" timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "black_billing_events_profile_idx" ON "black_billing_events" ("profile_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "black_billing_events_sub_idx" ON "black_billing_events" ("subscription_id", "created_at" DESC);

-- Keep the prior baseline available for a rollback and never overwrite a price
-- that already has effective-dated admin history.
CREATE TABLE IF NOT EXISTS "black_government_billing_price_backup" (LIKE "plan_prices" INCLUDING DEFAULTS);
ALTER TABLE "black_government_billing_price_backup" ADD PRIMARY KEY ("plan_code", "country_code");
INSERT INTO "black_government_billing_price_backup"
SELECT price.*
FROM "plan_prices" AS price
WHERE price."plan_code" = 'black'
  AND price."updated_by_staff_id" = ''
  AND NOT EXISTS (
      SELECT 1 FROM "plan_price_versions" AS version
      WHERE version."plan_code" = price."plan_code" AND version."country_code" = price."country_code"
  )
ON CONFLICT ("plan_code", "country_code") DO NOTHING;

-- Reconcile only untouched seed rows to the approved USD monthly price:
-- Nigeria = USD 300; other supported regions = USD 500.
UPDATE "plan_prices"
SET "currency" = 'USD',
    "monthly_amount_minor" = CASE WHEN "country_code" = 'NG' THEN 30000 ELSE 50000 END,
    "yearly_amount_minor" = 0,
    "ios_monthly_amount_minor" = 0,
    "ios_yearly_amount_minor" = 0,
    "android_monthly_amount_minor" = 0,
    "android_yearly_amount_minor" = 0,
    "store_product_ids" = '{}'::jsonb
WHERE "plan_code" = 'black' AND "updated_by_staff_id" = ''
  AND EXISTS (
      SELECT 1 FROM "black_government_billing_price_backup" AS backup
      WHERE backup."plan_code" = "plan_prices"."plan_code"
        AND backup."country_code" = "plan_prices"."country_code"
  );

-- For rows that already have only the synthetic legacy baseline, append the
-- approved price instead of mutating immutable price history. Preserve any
-- non-legacy admin-authored price version.
INSERT INTO "plan_price_versions" (
    "id", "created_at", "plan_code", "country_code", "currency", "monthly_amount_minor", "yearly_amount_minor",
    "ios_monthly_amount_minor", "ios_yearly_amount_minor", "android_monthly_amount_minor", "android_yearly_amount_minor",
    "store_product_ids", "active", "effective_from", "created_by_staff_id", "change_reason"
)
SELECT gen_random_uuid(), now(), price."plan_code", price."country_code", 'USD',
       CASE WHEN price."country_code" = 'NG' THEN 30000 ELSE 50000 END, 0,
       0, 0, 0, 0, '{}'::jsonb, price."active", now(), 'system',
       'Owner-approved Black Government USD monthly price'
FROM "plan_prices" AS price
WHERE price."plan_code" = 'black'
  AND NOT EXISTS (
      SELECT 1 FROM "plan_price_versions" AS version
      WHERE version."plan_code" = price."plan_code"
        AND version."country_code" = price."country_code"
        AND version."created_by_staff_id" <> 'legacy'
  )
  AND NOT EXISTS (
      SELECT 1 FROM "plan_price_versions" AS version
      WHERE version."plan_code" = price."plan_code"
        AND version."country_code" = price."country_code"
        AND version."created_by_staff_id" = 'system'
        AND version."change_reason" = 'Owner-approved Black Government USD monthly price'
  );
