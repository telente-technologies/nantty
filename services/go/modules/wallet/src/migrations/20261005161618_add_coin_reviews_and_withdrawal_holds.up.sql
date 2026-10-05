-- modify "coin_purchases" table
ALTER TABLE "coin_purchases" ADD COLUMN "review_status" character varying NOT NULL DEFAULT 'pending_review', ADD COLUMN "reviewed_by_staff_id" character varying NOT NULL DEFAULT '', ADD COLUMN "reviewed_at" timestamptz NULL, ADD COLUMN "review_note" character varying NOT NULL DEFAULT '';
-- create index "coinpurchase_review_status_id" to table: "coin_purchases"
CREATE INDEX "coinpurchase_review_status_id" ON "coin_purchases" ("review_status", "id" DESC);
-- modify "coin_transfers" table
ALTER TABLE "coin_transfers" ADD COLUMN "clawback_shortfall_coins" bigint NOT NULL DEFAULT 0, ADD COLUMN "reversed_at" timestamptz NULL, ADD COLUMN "review_status" character varying NOT NULL DEFAULT 'pending_review', ADD COLUMN "reviewed_by_staff_id" character varying NOT NULL DEFAULT '', ADD COLUMN "reviewed_at" timestamptz NULL, ADD COLUMN "review_note" character varying NOT NULL DEFAULT '';
-- create index "cointransfer_review_status_id" to table: "coin_transfers"
CREATE INDEX "cointransfer_review_status_id" ON "coin_transfers" ("review_status", "id" DESC);
-- modify "withdrawals" table
ALTER TABLE "withdrawals" ADD COLUMN "review_note" character varying NOT NULL DEFAULT '';
