ALTER TABLE developer_business_consents
  ADD COLUMN store_id uuid;

ALTER TABLE developer_business_consents
  DROP CONSTRAINT IF EXISTS developer_business_consents_application_id_recipient_accoun_key;

CREATE UNIQUE INDEX developer_business_consents_store_recipient_key
  ON developer_business_consents (application_id, store_id, recipient_account_id)
  WHERE store_id IS NOT NULL;

ALTER TABLE developer_business_consent_audit_logs
  ADD COLUMN store_id uuid;
