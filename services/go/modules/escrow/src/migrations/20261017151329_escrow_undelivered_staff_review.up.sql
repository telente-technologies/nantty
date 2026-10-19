-- modify "escrows" table
ALTER TABLE "escrows" ADD COLUMN "undelivered_review_at" timestamptz NULL;
-- create index "escrow_status_undelivered_review_at" to table: "escrows"
CREATE INDEX "escrow_status_undelivered_review_at" ON "escrows" ("status", "undelivered_review_at");
