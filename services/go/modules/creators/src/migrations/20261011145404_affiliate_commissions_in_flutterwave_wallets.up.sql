-- modify "affiliate_commission_reversals" table
ALTER TABLE "affiliate_commission_reversals" ADD COLUMN "applied" boolean NOT NULL DEFAULT true;
-- modify "affiliate_commissions" table
ALTER TABLE "affiliate_commissions" ALTER COLUMN "status" SET DEFAULT 'pending';
