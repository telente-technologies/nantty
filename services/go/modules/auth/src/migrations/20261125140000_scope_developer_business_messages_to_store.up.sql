ALTER TABLE developer_business_messages
  ADD COLUMN store_id uuid;

CREATE INDEX developer_business_messages_store_recipient_idx
  ON developer_business_messages (organization_id, application_id, store_id, recipient_account_id, created_at DESC, id DESC)
  WHERE store_id IS NOT NULL;
