CREATE TABLE "coin_store_account_tokens" (
  "id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "store" character varying NOT NULL,
  "created_at" timestamptz NOT NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "coin_store_account_tokens_store_check" CHECK ("store" IN ('apple_iap', 'google_play'))
);
CREATE UNIQUE INDEX "coin_store_account_tokens_user_store" ON "coin_store_account_tokens" ("user_id", "store");
