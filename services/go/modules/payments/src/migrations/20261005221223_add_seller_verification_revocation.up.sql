-- modify "seller_verifications" table
ALTER TABLE "seller_verifications" ADD COLUMN "revoked_at" timestamptz NULL, ADD COLUMN "revoked_event_id" character varying NOT NULL DEFAULT '';
