DROP TABLE IF EXISTS "developer_production_webhook_deliveries";
ALTER TABLE "developer_production_webhooks"
  DROP COLUMN IF EXISTS "last_error",
  DROP COLUMN IF EXISTS "last_delivery_at",
  DROP COLUMN IF EXISTS "verified_at",
  DROP COLUMN IF EXISTS "signing_secret_ciphertext";
