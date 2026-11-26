ALTER TABLE "developer_production_webhook_deliveries"
  ADD COLUMN IF NOT EXISTS "lease_expires_at" timestamptz NULL;

CREATE INDEX IF NOT EXISTS "developer_prod_wh_deliveries_claim_idx"
  ON "developer_production_webhook_deliveries" ("status", "next_attempt_at", "lease_expires_at");
