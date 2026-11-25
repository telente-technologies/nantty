DROP INDEX IF EXISTS developer_business_messages_store_recipient_idx;

ALTER TABLE developer_business_messages
  DROP COLUMN IF EXISTS store_id;
