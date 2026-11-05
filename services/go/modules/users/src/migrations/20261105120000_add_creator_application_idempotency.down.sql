DROP INDEX "creatorapplication_account_id_idempotency_key";
ALTER TABLE "creator_applications" DROP COLUMN "request_hash";
ALTER TABLE "creator_applications" DROP COLUMN "idempotency_key";
