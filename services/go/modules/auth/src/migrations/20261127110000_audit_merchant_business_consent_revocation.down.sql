DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM developer_business_consent_audit_logs
    WHERE actor_account_id IS NOT NULL AND actor_account_id <> recipient_account_id
  ) THEN
    RAISE EXCEPTION 'cannot remove merchant actor attribution from Business Messaging consent audit history';
  END IF;
END $$;

ALTER TABLE developer_business_consent_audit_logs
  DROP COLUMN IF EXISTS actor_account_id;
