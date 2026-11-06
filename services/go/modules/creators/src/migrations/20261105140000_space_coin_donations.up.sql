CREATE TABLE "space_coin_donations" (
  "id" uuid NOT NULL,
  "created_at" timestamptz NOT NULL,
  "sender_user_id" character varying NOT NULL,
  "host_user_id" character varying NOT NULL,
  "space_id" character varying NOT NULL,
  "coins" bigint NOT NULL,
  "platform_fee_coins" bigint NOT NULL,
  "creator_amount_coins" bigint NOT NULL,
  "creator_share_bps" bigint NOT NULL,
  "idempotency_key" character varying NOT NULL,
  "request_hash" character varying NOT NULL,
  "ledger_entry_id" uuid NOT NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "space_coin_donations_amounts_valid" CHECK (
    "coins" BETWEEN 1 AND 4611686018427387904 AND
    "platform_fee_coins" >= 0 AND "creator_amount_coins" >= 0 AND
    "coins" = "platform_fee_coins" + "creator_amount_coins" AND
    "creator_share_bps" BETWEEN 0 AND 7000
  )
);
CREATE UNIQUE INDEX "spacecoindonation_sender_idempotency" ON "space_coin_donations" ("sender_user_id", "idempotency_key");
CREATE INDEX "spacecoindonation_host_created" ON "space_coin_donations" ("host_user_id", "created_at");
CREATE INDEX "spacecoindonation_space_created" ON "space_coin_donations" ("space_id", "created_at");
