DROP TABLE IF EXISTS "black_billing_events";
DROP INDEX IF EXISTS "subscriptions_live_per_profile";
CREATE UNIQUE INDEX "subscriptions_live_per_profile" ON "subscriptions" ("profile_id", "plan_code")
    WHERE ((status)::text = ANY ((ARRAY['pending'::character varying, 'awaiting_card'::character varying, 'trialing'::character varying, 'active'::character varying, 'past_due'::character varying, 'grace'::character varying])::text[]));

UPDATE "plan_prices" AS price
SET "currency" = backup."currency",
    "monthly_amount_minor" = backup."monthly_amount_minor",
    "yearly_amount_minor" = backup."yearly_amount_minor",
    "ios_monthly_amount_minor" = backup."ios_monthly_amount_minor",
    "ios_yearly_amount_minor" = backup."ios_yearly_amount_minor",
    "android_monthly_amount_minor" = backup."android_monthly_amount_minor",
    "android_yearly_amount_minor" = backup."android_yearly_amount_minor",
    "store_product_ids" = backup."store_product_ids",
    "active" = backup."active",
    "updated_by_staff_id" = backup."updated_by_staff_id",
    "updated_at" = backup."updated_at"
FROM "black_government_billing_price_backup" AS backup
WHERE price."plan_code" = backup."plan_code" AND price."country_code" = backup."country_code";

DROP TABLE IF EXISTS "black_government_billing_price_backup";

ALTER TABLE "subscriptions" DROP COLUMN IF EXISTS "recurring_consent_at";
ALTER TABLE "subscriptions" DROP COLUMN IF EXISTS "terms_accepted_at";
ALTER TABLE "subscriptions" DROP COLUMN IF EXISTS "verified_jurisdiction_country";
ALTER TABLE "subscriptions" DROP COLUMN IF EXISTS "black_application_id";
ALTER TABLE "subscriptions" DROP COLUMN IF EXISTS "paused_reason";
