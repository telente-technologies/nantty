CREATE TABLE IF NOT EXISTS "developer_business_consents" (
  "id" uuid PRIMARY KEY,
  "organization_id" uuid NOT NULL REFERENCES developer_organizations(id) ON DELETE CASCADE,
  "application_id" uuid NOT NULL REFERENCES developer_applications(id) ON DELETE CASCADE,
  "recipient_account_id" uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  "status" varchar(24) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  "scopes" jsonb NOT NULL DEFAULT '["messages:send","conversations:read"]'::jsonb,
  "granted_at" timestamptz NOT NULL,
  "revoked_at" timestamptz NULL,
  UNIQUE ("application_id", "recipient_account_id")
);
CREATE INDEX IF NOT EXISTS "developer_business_consents_org_idx" ON "developer_business_consents" ("organization_id", "application_id", "status");

CREATE TABLE IF NOT EXISTS "developer_business_messages" (
  "id" uuid PRIMARY KEY,
  "organization_id" uuid NOT NULL REFERENCES developer_organizations(id) ON DELETE CASCADE,
  "application_id" uuid NOT NULL REFERENCES developer_applications(id) ON DELETE CASCADE,
  "credential_id" uuid REFERENCES developer_production_credentials(id) ON DELETE SET NULL,
  "recipient_account_id" uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  "body_text" text NOT NULL,
  "status" varchar(24) NOT NULL DEFAULT 'accepted' CHECK (status IN ('accepted', 'dispatched', 'failed')),
  "external_message_id" varchar(128) NULL,
  "error_reason" text NULL,
  "created_at" timestamptz NOT NULL,
  "updated_at" timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS "developer_business_messages_app_idx" ON "developer_business_messages" ("application_id", "recipient_account_id", "created_at" DESC);
