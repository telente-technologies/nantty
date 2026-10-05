-- modify "affiliate_commissions" table
ALTER TABLE "affiliate_commissions" ADD COLUMN "reversed_minor" bigint NOT NULL DEFAULT 0;
-- create "affiliate_commission_reversals" table
CREATE TABLE "affiliate_commission_reversals" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "commission_id" character varying NOT NULL, "refund_key" character varying NOT NULL, "amount_minor" bigint NOT NULL, "recovered_minor" bigint NOT NULL, "shortfall_minor" bigint NOT NULL, PRIMARY KEY ("id"));
-- create index "affiliatecommissionreversal_commission_id_refund_key" to table: "affiliate_commission_reversals"
CREATE UNIQUE INDEX "affiliatecommissionreversal_commission_id_refund_key" ON "affiliate_commission_reversals" ("commission_id", "refund_key");
