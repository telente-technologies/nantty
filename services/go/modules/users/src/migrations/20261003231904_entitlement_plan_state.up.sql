-- modify "profile_signals" table
ALTER TABLE "profile_signals" ADD COLUMN "premium_until" timestamptz NULL, ADD COLUMN "seller_plan_until" timestamptz NULL, ADD COLUMN "seller_plan_trialing" boolean NOT NULL DEFAULT false;
