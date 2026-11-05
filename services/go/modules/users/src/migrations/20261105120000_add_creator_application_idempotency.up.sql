-- Add durable, account-scoped replay identity to creator application submissions.
ALTER TABLE "creator_applications" ADD COLUMN "idempotency_key" character varying NULL;
ALTER TABLE "creator_applications" ADD COLUMN "request_hash" character varying NULL;
CREATE UNIQUE INDEX "creatorapplication_account_id_idempotency_key" ON "creator_applications" ("account_id", "idempotency_key");
