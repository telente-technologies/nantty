DROP INDEX IF EXISTS developer_business_messages_app_idempotency_idx;

ALTER TABLE developer_business_messages
  DROP COLUMN IF EXISTS request_hash,
  DROP COLUMN IF EXISTS idempotency_key;
