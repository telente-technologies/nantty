CREATE TABLE IF NOT EXISTS developer_business_consent_authorization_codes (
  code_hash varchar(64) PRIMARY KEY,
  consent_id uuid NOT NULL REFERENCES developer_business_consents(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES developer_organizations(id) ON DELETE CASCADE,
  application_id uuid NOT NULL REFERENCES developer_applications(id) ON DELETE CASCADE,
  store_id uuid NOT NULL,
  recipient_account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  consent_granted_at timestamptz NOT NULL,
  redirect_uri varchar(2048) NOT NULL,
  code_challenge varchar(43) NOT NULL,
  scopes jsonb NOT NULL CHECK (jsonb_typeof(scopes) = 'array'),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz NULL,
  consumed_by_credential_id uuid NULL REFERENCES developer_production_credentials(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS developer_business_consent_codes_expiry_idx
  ON developer_business_consent_authorization_codes (expires_at)
  WHERE consumed_at IS NULL;
