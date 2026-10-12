-- modify "affiliate_commissions" table
ALTER TABLE "affiliate_commissions" ADD COLUMN "transfer_attempts" bigint NOT NULL DEFAULT 0, ADD COLUMN "retry_after" timestamptz NULL;
-- create index "affiliatecommission_status_id" to table: "affiliate_commissions"
CREATE INDEX "affiliatecommission_status_id" ON "affiliate_commissions" ("status", "id");
