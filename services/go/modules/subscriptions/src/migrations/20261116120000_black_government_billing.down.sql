DROP TABLE IF EXISTS "black_billing_events";
DROP INDEX IF EXISTS "subscriptions_live_per_profile";
CREATE UNIQUE INDEX "subscriptions_live_per_profile" ON "subscriptions" ("profile_id", "plan_code")
    WHERE ((status)::text = ANY ((ARRAY['pending'::character varying, 'awaiting_card'::character varying, 'trialing'::character varying, 'active'::character varying, 'past_due'::character varying, 'grace'::character varying])::text[]));
ALTER TABLE "subscriptions" DROP COLUMN IF EXISTS "recurring_consent_at";
ALTER TABLE "subscriptions" DROP COLUMN IF EXISTS "terms_accepted_at";
ALTER TABLE "subscriptions" DROP COLUMN IF EXISTS "verified_jurisdiction_country";
ALTER TABLE "subscriptions" DROP COLUMN IF EXISTS "black_application_id";
ALTER TABLE "subscriptions" DROP COLUMN IF EXISTS "paused_reason";
