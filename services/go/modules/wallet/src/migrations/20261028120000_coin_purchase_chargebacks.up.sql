CREATE TABLE "coin_purchase_chargebacks" (
    "id" uuid NOT NULL,
    "created_at" timestamptz NOT NULL,
    "purchase_id" uuid NOT NULL,
    "provider" character varying NOT NULL,
    "provider_dispute_id" character varying NOT NULL,
    "amount_minor" bigint NOT NULL,
    "coins_clawed" bigint NOT NULL DEFAULT 0,
    "updated_at" timestamptz NOT NULL,
    PRIMARY KEY ("id"),
    CONSTRAINT "coin_purchase_chargebacks_amounts_valid" CHECK ("amount_minor" > 0 AND "coins_clawed" >= 0),
    CONSTRAINT "coin_purchase_chargebacks_coin_purchases_chargebacks" FOREIGN KEY ("purchase_id") REFERENCES "coin_purchases" ("id") ON DELETE NO ACTION
);
CREATE UNIQUE INDEX "coinpurchasechargeback_provider_provider_dispute_id" ON "coin_purchase_chargebacks" ("provider", "provider_dispute_id");
CREATE INDEX "coinpurchasechargeback_purchase_id_created_at" ON "coin_purchase_chargebacks" ("purchase_id", "created_at");
