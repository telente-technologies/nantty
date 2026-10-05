-- reverse: modify "withdrawals" table
ALTER TABLE "withdrawals" DROP COLUMN "review_note";
-- reverse: create index "cointransfer_review_status_id" to table: "coin_transfers"
DROP INDEX "cointransfer_review_status_id";
-- reverse: modify "coin_transfers" table
ALTER TABLE "coin_transfers" DROP COLUMN "review_note", DROP COLUMN "reviewed_at", DROP COLUMN "reviewed_by_staff_id", DROP COLUMN "review_status", DROP COLUMN "reversed_at", DROP COLUMN "clawback_shortfall_coins";
-- reverse: create index "coinpurchase_review_status_id" to table: "coin_purchases"
DROP INDEX "coinpurchase_review_status_id";
-- reverse: modify "coin_purchases" table
ALTER TABLE "coin_purchases" DROP COLUMN "review_note", DROP COLUMN "reviewed_at", DROP COLUMN "reviewed_by_staff_id", DROP COLUMN "review_status";
