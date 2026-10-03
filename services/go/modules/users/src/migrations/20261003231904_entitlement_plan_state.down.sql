-- reverse: modify "profile_signals" table
ALTER TABLE "profile_signals" DROP COLUMN "seller_plan_trialing", DROP COLUMN "seller_plan_until", DROP COLUMN "premium_until";
