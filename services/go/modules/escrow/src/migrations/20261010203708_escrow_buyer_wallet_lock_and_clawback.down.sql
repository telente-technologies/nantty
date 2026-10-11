-- reverse: modify "escrows" table
ALTER TABLE "escrows" DROP COLUMN "direct_paid_out_at", DROP COLUMN "direct_payout_reference", DROP COLUMN "wallet_hold_minor", DROP COLUMN "wallet_funded_at";
