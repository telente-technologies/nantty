-- reverse: modify "seller_verifications" table
ALTER TABLE "seller_verifications" DROP COLUMN "revoked_event_id", DROP COLUMN "revoked_at";
