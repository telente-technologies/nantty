ALTER TABLE "developer_production_webhooks"
  ADD COLUMN IF NOT EXISTS "signing_secret_ciphertext" text NULL,
  ADD COLUMN IF NOT EXISTS "verified_at" timestamptz NULL,
  ADD COLUMN IF NOT EXISTS "last_delivery_at" timestamptz NULL,
  ADD COLUMN IF NOT EXISTS "last_error" text NULL;

CREATE TABLE IF NOT EXISTS "developer_production_webhook_deliveries" (
  "id" uuid PRIMARY KEY,
  "webhook_id" uuid NOT NULL REFERENCES developer_production_webhooks(id) ON DELETE CASCADE,
  "application_id" uuid NOT NULL REFERENCES developer_applications(id) ON DELETE CASCADE,
  "organization_id" uuid NOT NULL REFERENCES developer_organizations(id) ON DELETE CASCADE,
  "event_id" uuid NOT NULL,
  "event_type" varchar(120) NOT NULL,
  "payload" jsonb NOT NULL,
  "status" varchar(24) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'delivered', 'failed')),
  "attempt_count" integer NOT NULL DEFAULT 0,
  "next_attempt_at" timestamptz NOT NULL DEFAULT now(),
  "last_status_code" integer NULL,
  "last_error" text NULL,
  "delivered_at" timestamptz NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "developer_prod_wh_deliveries_due_idx"
  ON "developer_production_webhook_deliveries" ("status", "next_attempt_at");
