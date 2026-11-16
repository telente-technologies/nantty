CREATE TABLE developer_applications (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES developer_organizations(id) ON DELETE CASCADE,
  name varchar(80) NOT NULL,
  purpose varchar(1000) NOT NULL,
  api_product varchar(40) NOT NULL CHECK (api_product = 'business_messaging'),
  callback_origins jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(callback_origins) = 'array'),
  requested_scopes jsonb NOT NULL CHECK (jsonb_typeof(requested_scopes) = 'array' AND jsonb_array_length(requested_scopes) > 0),
  status varchar(24) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review_pending', 'approved', 'rejected', 'suspended', 'archived')),
  created_by_account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE NO ACTION,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE INDEX developer_applications_org_status_created
  ON developer_applications (organization_id, status, created_at DESC);

CREATE TABLE developer_application_idempotency (
  organization_id uuid NOT NULL REFERENCES developer_organizations(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  idempotency_key varchar(128) NOT NULL,
  request_fingerprint varchar(64) NOT NULL CHECK (request_fingerprint ~ '^[0-9a-f]{64}$'),
  application_id uuid REFERENCES developer_applications(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  PRIMARY KEY (organization_id, account_id, idempotency_key)
);

CREATE INDEX developer_application_idempotency_expiry
  ON developer_application_idempotency (expires_at);
