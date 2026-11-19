ALTER TABLE "payout_accounts" ADD COLUMN "branch_code" character varying NOT NULL DEFAULT '';
ALTER TABLE "payout_account_resolutions" ADD COLUMN "branch_code" character varying NOT NULL DEFAULT '';
