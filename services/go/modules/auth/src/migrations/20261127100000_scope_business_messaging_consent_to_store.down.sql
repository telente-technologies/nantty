DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM developer_business_consents WHERE store_id IS NOT NULL) THEN
    RAISE EXCEPTION 'cannot downgrade store-scoped Business Messaging consents without an explicit data and authorization migration';
  END IF;
END $$;

DROP INDEX IF EXISTS developer_business_consents_store_recipient_key;

ALTER TABLE developer_business_consents
  ADD CONSTRAINT developer_business_consents_app_recipient_key
  UNIQUE (application_id, recipient_account_id);

ALTER TABLE developer_business_consents
  DROP COLUMN IF EXISTS store_id;
