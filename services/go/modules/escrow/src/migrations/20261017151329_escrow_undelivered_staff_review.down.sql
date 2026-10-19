-- reverse: create index "escrow_status_undelivered_review_at" to table: "escrows"
DROP INDEX "escrow_status_undelivered_review_at";
-- reverse: modify "escrows" table
ALTER TABLE "escrows" DROP COLUMN "undelivered_review_at";
