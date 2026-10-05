-- reverse: create index "affiliatecommissionreversal_commission_id_refund_key" to table: "affiliate_commission_reversals"
DROP INDEX "affiliatecommissionreversal_commission_id_refund_key";
-- reverse: create "affiliate_commission_reversals" table
DROP TABLE "affiliate_commission_reversals";
-- reverse: modify "affiliate_commissions" table
ALTER TABLE "affiliate_commissions" DROP COLUMN "reversed_minor";
