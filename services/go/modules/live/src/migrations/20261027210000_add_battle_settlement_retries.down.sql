DROP INDEX IF EXISTS "battles_state_settlement_retry";
ALTER TABLE "battles"
    DROP COLUMN IF EXISTS "settlement_lease_token",
    DROP COLUMN IF EXISTS "settlement_next_attempt_at",
    DROP COLUMN IF EXISTS "settlement_lease_until",
    DROP COLUMN IF EXISTS "settlement_attempts";
