-- modify "escrows" table
ALTER TABLE "escrows" ADD COLUMN "wallet_funded_at" timestamptz NULL, ADD COLUMN "wallet_hold_minor" bigint NOT NULL DEFAULT 0, ADD COLUMN "direct_payout_reference" character varying NOT NULL DEFAULT '', ADD COLUMN "direct_paid_out_at" timestamptz NULL;
