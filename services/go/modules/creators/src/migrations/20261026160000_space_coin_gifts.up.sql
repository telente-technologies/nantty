CREATE TABLE "space_coin_gifts" (
  "id" uuid NOT NULL,
  "created_at" timestamptz NOT NULL,
  "sender_user_id" character varying NOT NULL,
  "host_user_id" character varying NOT NULL,
  "space_id" character varying NOT NULL,
  "gift_id" character varying NOT NULL,
  "quantity" bigint NOT NULL,
  "unit_price_coins" bigint NOT NULL,
  "total_coins" bigint NOT NULL,
  "platform_fee_coins" bigint NOT NULL,
  "creator_amount_coins" bigint NOT NULL,
  "creator_share_bps" bigint NOT NULL,
  "idempotency_key" character varying NOT NULL,
  "request_hash" character varying NOT NULL,
  "ledger_entry_id" uuid NOT NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "space_coin_gifts_amounts_valid" CHECK (
    "quantity" BETWEEN 1 AND 100 AND "unit_price_coins" > 0 AND "total_coins" > 0 AND
    "platform_fee_coins" >= 0 AND "creator_amount_coins" >= 0 AND
    "total_coins" = "platform_fee_coins" + "creator_amount_coins" AND
    "creator_share_bps" BETWEEN 0 AND 7000
  )
);
CREATE UNIQUE INDEX "spacecoingift_sender_idempotency" ON "space_coin_gifts" ("sender_user_id", "idempotency_key");
CREATE INDEX "spacecoingift_host_created" ON "space_coin_gifts" ("host_user_id", "created_at");
CREATE INDEX "spacecoingift_space_created" ON "space_coin_gifts" ("space_id", "created_at");
