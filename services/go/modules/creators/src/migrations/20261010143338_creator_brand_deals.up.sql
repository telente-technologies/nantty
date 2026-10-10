-- create "creator_brand_deals" table
CREATE TABLE "creator_brand_deals" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "creator_user_id" character varying NOT NULL, "brand_name" character varying NOT NULL, "amount_minor" bigint NOT NULL, "currency" character varying NOT NULL, "starts_at" timestamptz NOT NULL, "ends_at" timestamptz NULL, "disclosure" character varying NOT NULL, "notes" character varying NOT NULL DEFAULT '', "idempotency_key" character varying NOT NULL, PRIMARY KEY ("id"), CONSTRAINT "creator_brand_deals_amount_not_negative" CHECK (amount_minor >= 0), CONSTRAINT "creator_brand_deals_ends_after_start" CHECK ((ends_at IS NULL) OR (ends_at >= starts_at)));
-- create index "creatorbranddeal_creator_user_id_created_at" to table: "creator_brand_deals"
CREATE INDEX "creatorbranddeal_creator_user_id_created_at" ON "creator_brand_deals" ("creator_user_id", "created_at");
-- create index "creatorbranddeal_creator_user_id_idempotency_key" to table: "creator_brand_deals"
CREATE UNIQUE INDEX "creatorbranddeal_creator_user_id_idempotency_key" ON "creator_brand_deals" ("creator_user_id", "idempotency_key");
