DROP INDEX IF EXISTS "developer_prod_wh_deliveries_claim_idx";

ALTER TABLE "developer_production_webhook_deliveries"
  DROP COLUMN IF EXISTS "lease_expires_at";
