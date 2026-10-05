-- modify "coin_purchases" table
ALTER TABLE "coin_purchases" ALTER COLUMN "review_status" SET DEFAULT 'not_required', ADD COLUMN "review_flags" jsonb NULL;
-- modify "coin_transfers" table
ALTER TABLE "coin_transfers" ALTER COLUMN "review_status" SET DEFAULT 'not_required', ADD COLUMN "review_flags" jsonb NULL;
