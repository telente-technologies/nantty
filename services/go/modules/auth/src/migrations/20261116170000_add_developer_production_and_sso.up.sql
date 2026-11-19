CREATE TABLE IF NOT EXISTS "developer_sso_codes" (
  "code_hash" varchar(64) PRIMARY KEY,
  "account_id" uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  "session_id" uuid NOT NULL,
  "client_id" varchar(128) NOT NULL,
  "redirect_uri" varchar(512) NOT NULL,
  "code_challenge" varchar(128) NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "consumed_at" timestamptz NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "developer_production_credentials" (
  "id" uuid PRIMARY KEY,
  "application_id" uuid NOT NULL REFERENCES developer_applications(id) ON DELETE CASCADE,
  "organization_id" uuid NOT NULL REFERENCES developer_organizations(id) ON DELETE CASCADE,
  "name" varchar(80) NOT NULL,
  "prefix" varchar(32) NOT NULL,
  "secret_hash" varchar(64) NOT NULL UNIQUE,
  "scopes" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "status" varchar(24) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  "created_by_account_id" uuid NOT NULL REFERENCES accounts(id) ON DELETE NO ACTION,
  "created_at" timestamptz NOT NULL,
  "revoked_at" timestamptz NULL,
  "last_used_at" timestamptz NULL
);
CREATE INDEX IF NOT EXISTS "developer_prod_creds_app_idx" ON "developer_production_credentials" ("application_id", "created_at" DESC);

CREATE TABLE IF NOT EXISTS "developer_production_webhooks" (
  "id" uuid PRIMARY KEY,
  "application_id" uuid NOT NULL REFERENCES developer_applications(id) ON DELETE CASCADE,
  "organization_id" uuid NOT NULL REFERENCES developer_organizations(id) ON DELETE CASCADE,
  "url" varchar(512) NOT NULL,
  "events" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "signing_secret_preview" varchar(32) NOT NULL,
  "signing_secret_hash" varchar(64) NOT NULL,
  "active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL,
  "updated_at" timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS "developer_prod_webhooks_app_idx" ON "developer_production_webhooks" ("application_id", "created_at" DESC);

CREATE TABLE IF NOT EXISTS "developer_production_requests" (
  "id" uuid PRIMARY KEY,
  "application_id" uuid NOT NULL REFERENCES developer_applications(id) ON DELETE CASCADE,
  "organization_id" uuid NOT NULL REFERENCES developer_organizations(id) ON DELETE CASCADE,
  "credential_id" uuid REFERENCES developer_production_credentials(id) ON DELETE SET NULL,
  "method" varchar(12) NOT NULL,
  "path" varchar(255) NOT NULL,
  "status_code" integer NOT NULL,
  "latency_ms" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS "developer_prod_requests_app_idx" ON "developer_production_requests" ("application_id", "created_at" DESC);

CREATE TABLE IF NOT EXISTS "developer_billing_subscriptions" (
  "organization_id" uuid PRIMARY KEY REFERENCES developer_organizations(id) ON DELETE CASCADE,
  "plan_tier" varchar(32) NOT NULL DEFAULT 'sandbox' CHECK (plan_tier IN ('sandbox', 'starter', 'growth', 'enterprise')),
  "status" varchar(24) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'past_due', 'cancelled')),
  "monthly_quota" bigint NOT NULL DEFAULT 10000,
  "current_period_end" timestamptz NULL,
  "provider_reference" varchar(128) NULL,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
