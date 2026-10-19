-- modify "payout_transfers" table
ALTER TABLE "payout_transfers" ADD COLUMN "send_claimed_at" timestamptz NULL;
