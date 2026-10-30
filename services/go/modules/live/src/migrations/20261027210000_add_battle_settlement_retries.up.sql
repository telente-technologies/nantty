ALTER TABLE "battles"
    ADD COLUMN "settlement_attempts" integer NOT NULL DEFAULT 0,
    ADD COLUMN "settlement_lease_until" timestamptz NULL,
    ADD COLUMN "settlement_next_attempt_at" timestamptz NULL,
    ADD COLUMN "settlement_lease_token" character varying NULL;

CREATE INDEX "battles_state_settlement_retry" ON "battles" ("state", "settlement_next_attempt_at", "settlement_lease_until");
