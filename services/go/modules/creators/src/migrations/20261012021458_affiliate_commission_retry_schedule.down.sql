-- reverse: create index "affiliatecommission_status_id" to table: "affiliate_commissions"
DROP INDEX "affiliatecommission_status_id";
-- reverse: modify "affiliate_commissions" table
ALTER TABLE "affiliate_commissions" DROP COLUMN "retry_after", DROP COLUMN "transfer_attempts";
