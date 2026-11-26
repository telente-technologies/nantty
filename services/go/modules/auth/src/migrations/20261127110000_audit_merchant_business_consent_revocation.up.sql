ALTER TABLE developer_business_consent_audit_logs
  ADD COLUMN actor_account_id uuid REFERENCES accounts(id) ON DELETE SET NULL;

UPDATE developer_business_consent_audit_logs
  SET actor_account_id = recipient_account_id
  WHERE actor_account_id IS NULL;
