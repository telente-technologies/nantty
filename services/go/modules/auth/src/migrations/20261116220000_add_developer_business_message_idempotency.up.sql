ALTER TABLE developer_business_messages
  ADD COLUMN idempotency_key varchar(128),
  ADD COLUMN request_hash varchar(64);

CREATE UNIQUE INDEX developer_business_messages_app_idempotency_idx
  ON developer_business_messages (application_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
