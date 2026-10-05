-- reverse: modify "coin_transfers" table
ALTER TABLE "coin_transfers" DROP COLUMN "review_flags", ALTER COLUMN "review_status" SET DEFAULT 'pending_review';
-- reverse: modify "coin_purchases" table
ALTER TABLE "coin_purchases" DROP COLUMN "review_flags", ALTER COLUMN "review_status" SET DEFAULT 'pending_review';
