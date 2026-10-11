-- reverse: modify "affiliate_commissions" table
ALTER TABLE "affiliate_commissions" ALTER COLUMN "status" SET DEFAULT 'paid';
-- reverse: modify "affiliate_commission_reversals" table
ALTER TABLE "affiliate_commission_reversals" DROP COLUMN "applied";
