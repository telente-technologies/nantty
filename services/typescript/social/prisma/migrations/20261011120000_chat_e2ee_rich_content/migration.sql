-- Locations, polls, votes, reactions, documents, shared items and group attributes move inside the E2EE envelope.
ALTER TYPE "MessageKind" ADD VALUE IF NOT EXISTS 'control';

-- Legacy plaintext rows cannot be re-encrypted by the server: delete them (dev data only).
DELETE FROM "messages"
WHERE "ciphertext" IS NULL
  AND "kind" <> 'system'
  AND "protocol" <> 'store-plaintext-v1';

DROP TABLE IF EXISTS "message_poll_votes";
DROP TABLE IF EXISTS "message_poll_options";
DROP TABLE IF EXISTS "message_reactions";

ALTER TABLE "messages"
  DROP COLUMN IF EXISTS "sharedContent",
  DROP COLUMN IF EXISTS "location",
  DROP COLUMN IF EXISTS "document",
  DROP COLUMN IF EXISTS "pollQuestion",
  DROP COLUMN IF EXISTS "pollAllowMultiple",
  ALTER COLUMN "protocol" SET DEFAULT 'signal-v1';

ALTER TABLE "conversations" ADD COLUMN "encryptedAttributes" TEXT;
UPDATE "conversations" SET "title" = NULL, "description" = NULL WHERE "kind" = 'group';
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_group_attributes_sealed" CHECK ("kind" <> 'group' OR ("title" IS NULL AND "description" IS NULL));
