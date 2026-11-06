CREATE TABLE "live_battle_coin_contributions" (
  "id" uuid NOT NULL,
  "created_at" timestamptz NOT NULL,
  "sender_user_id" character varying NOT NULL,
  "recipient_user_id" character varying NOT NULL,
  "battle_id" character varying NOT NULL,
  "live_id" character varying NOT NULL,
  "coins" bigint NOT NULL,
  "platform_fee_coins" bigint NOT NULL,
  "holding_coins" bigint NOT NULL,
  "idempotency_key" character varying NOT NULL,
  "request_hash" character varying NOT NULL,
  "ledger_entry_id" uuid NOT NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "live_battle_contribution_amounts_valid" CHECK (
    "coins" BETWEEN 1 AND 4611686018427387904 AND
    "platform_fee_coins" >= 0 AND "holding_coins" >= 0 AND
    "coins" = "platform_fee_coins" + "holding_coins"
  )
);
CREATE UNIQUE INDEX "livebattlecontribution_sender_idempotency" ON "live_battle_coin_contributions" ("sender_user_id", "idempotency_key");
CREATE INDEX "livebattlecontribution_battle_created" ON "live_battle_coin_contributions" ("battle_id", "created_at");
CREATE INDEX "livebattlecontribution_recipient_created" ON "live_battle_coin_contributions" ("recipient_user_id", "created_at");
