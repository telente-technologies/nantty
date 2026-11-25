CREATE TABLE developer_business_authorizations (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES developer_organizations(id) ON DELETE CASCADE,
  application_id uuid NOT NULL REFERENCES developer_applications(id) ON DELETE CASCADE,
  store_id uuid NOT NULL,
  store_name varchar(160) NOT NULL,
  granted_by_account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  status varchar(24) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  scopes jsonb NOT NULL CHECK (jsonb_typeof(scopes) = 'array'),
  granted_at timestamptz NOT NULL,
  revoked_at timestamptz NULL,
  UNIQUE (application_id, store_id)
);

CREATE INDEX developer_business_authorizations_grantor_idx
  ON developer_business_authorizations (granted_by_account_id, granted_at DESC, id DESC);
CREATE INDEX developer_business_authorizations_app_status_idx
  ON developer_business_authorizations (organization_id, application_id, status);

CREATE TABLE developer_business_authorization_audit_logs (
  id uuid PRIMARY KEY,
  authorization_id uuid NOT NULL,
  organization_id uuid NOT NULL,
  application_id uuid NOT NULL,
  store_id uuid NOT NULL,
  actor_account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  action varchar(32) NOT NULL CHECK (action IN ('granted', 'updated', 'revoked')),
  before_scopes jsonb NOT NULL DEFAULT '[]'::jsonb,
  after_scopes jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL
);

CREATE INDEX developer_business_authorization_audit_actor_idx
  ON developer_business_authorization_audit_logs (actor_account_id, created_at DESC, id DESC);
CREATE INDEX developer_business_authorization_audit_app_idx
  ON developer_business_authorization_audit_logs (organization_id, application_id, created_at DESC, id DESC);
