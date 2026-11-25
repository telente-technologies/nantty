CREATE TABLE developer_business_consent_audit_logs (
  id uuid PRIMARY KEY,
  consent_id uuid NOT NULL,
  organization_id uuid NOT NULL,
  application_id uuid NOT NULL,
  recipient_account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  action varchar(32) NOT NULL CHECK (action IN ('granted', 'updated', 'revoked')),
  before_scopes jsonb NOT NULL DEFAULT '[]'::jsonb,
  after_scopes jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL
);

CREATE INDEX developer_business_consent_audit_account_idx
  ON developer_business_consent_audit_logs (recipient_account_id, created_at DESC, id DESC);

CREATE INDEX developer_business_consent_audit_app_idx
  ON developer_business_consent_audit_logs (organization_id, application_id, created_at DESC, id DESC);
