CREATE TABLE IF NOT EXISTS "seller_api_keys" (
  "id" uuid PRIMARY KEY,
  "store_id" uuid NOT NULL,
  "name" varchar(60) NOT NULL,
  "prefix" varchar(32) NOT NULL,
  "secret_hash" varchar(64) NOT NULL UNIQUE,
  "scopes" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "created_by" uuid NOT NULL,
  "created_at" timestamptz NOT NULL,
  "last_used_at" timestamptz NULL,
  "revoked_at" timestamptz NULL
);
CREATE INDEX IF NOT EXISTS "seller_api_keys_store_idx" ON "seller_api_keys" ("store_id", "created_at" DESC);

CREATE TABLE IF NOT EXISTS "seller_webhook_endpoints" (
  "id" uuid PRIMARY KEY,
  "store_id" uuid NOT NULL,
  "url" varchar(512) NOT NULL,
  "description" varchar(80) NOT NULL DEFAULT '',
  "events" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "active" boolean NOT NULL DEFAULT true,
  "signing_secret" varchar(128) NOT NULL,
  "signing_secret_preview" varchar(32) NOT NULL,
  "created_at" timestamptz NOT NULL,
  "last_delivery_at" timestamptz NULL,
  "recent_failure_count" integer NOT NULL DEFAULT 0,
  "updated_at" timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS "seller_webhooks_store_idx" ON "seller_webhook_endpoints" ("store_id", "created_at" DESC);

CREATE TABLE IF NOT EXISTS "seller_webhook_deliveries" (
  "id" uuid PRIMARY KEY,
  "store_id" uuid NOT NULL,
  "webhook_id" uuid NOT NULL REFERENCES seller_webhook_endpoints(id) ON DELETE CASCADE,
  "event" varchar(64) NOT NULL,
  "response_status" integer NULL,
  "duration_milliseconds" integer NULL,
  "outcome" varchar(24) NOT NULL,
  "attempted_at" timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS "seller_webhook_deliveries_store_idx" ON "seller_webhook_deliveries" ("store_id", "attempted_at" DESC);
