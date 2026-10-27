-- modify "creator_program_members" table
ALTER TABLE "creator_program_members" ADD COLUMN "suspension_reason" character varying NOT NULL DEFAULT '', ADD COLUMN "suspended_at" timestamptz NULL;
-- create "affiliate_commissions" table
CREATE TABLE "affiliate_commissions" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "order_id" character varying NOT NULL, "order_number" character varying NOT NULL DEFAULT '', "order_item_id" character varying NOT NULL, "product_id" character varying NOT NULL, "store_id" character varying NOT NULL, "seller_user_id" character varying NOT NULL, "creator_id" character varying NOT NULL, "attribution_source" character varying NOT NULL, "attribution_id" character varying NOT NULL, "sale_minor" bigint NOT NULL, "commission_bps" bigint NOT NULL, "commission_minor" bigint NOT NULL, "currency" character varying NOT NULL, "status" character varying NOT NULL DEFAULT 'paid', "ordered_at" timestamptz NULL, "paid_at" timestamptz NULL, PRIMARY KEY ("id"));
-- create index "affiliatecommission_creator_id_created_at" to table: "affiliate_commissions"
CREATE INDEX "affiliatecommission_creator_id_created_at" ON "affiliate_commissions" ("creator_id", "created_at");
-- create index "affiliatecommission_order_id" to table: "affiliate_commissions"
CREATE INDEX "affiliatecommission_order_id" ON "affiliate_commissions" ("order_id");
-- create index "affiliatecommission_order_item_id" to table: "affiliate_commissions"
CREATE UNIQUE INDEX "affiliatecommission_order_item_id" ON "affiliate_commissions" ("order_item_id");
-- create index "affiliatecommission_store_id_created_at" to table: "affiliate_commissions"
CREATE INDEX "affiliatecommission_store_id_created_at" ON "affiliate_commissions" ("store_id", "created_at");
-- create "affiliate_product_commissions" table
CREATE TABLE "affiliate_product_commissions" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "store_id" character varying NOT NULL, "product_id" character varying NOT NULL, "commission_bps" bigint NULL, "is_excluded" boolean NOT NULL DEFAULT false, "updated_by" character varying NOT NULL DEFAULT '', "updated_at" timestamptz NOT NULL, PRIMARY KEY ("id"));
-- create index "affiliateproductcommission_store_id_product_id" to table: "affiliate_product_commissions"
CREATE UNIQUE INDEX "affiliateproductcommission_store_id_product_id" ON "affiliate_product_commissions" ("store_id", "product_id");
-- create "affiliate_program_settings" table
CREATE TABLE "affiliate_program_settings" ("id" character varying NOT NULL, "seller_user_id" character varying NOT NULL, "currency" character varying NOT NULL DEFAULT '', "enabled" boolean NOT NULL DEFAULT false, "default_commission_bps" bigint NOT NULL DEFAULT 0, "auto_approve_followers_above" bigint NULL, "cookie_window_days" bigint NOT NULL DEFAULT 30, "updated_at" timestamptz NOT NULL, PRIMARY KEY ("id"));
-- create "creator_affiliations" table
CREATE TABLE "creator_affiliations" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "creator_id" character varying NOT NULL, "store_id" character varying NOT NULL, "product_id" character varying NOT NULL DEFAULT '', "status" character varying NOT NULL DEFAULT 'requested', "message" character varying NOT NULL DEFAULT '', "decision_reason" character varying NOT NULL DEFAULT '', "decided_at" timestamptz NULL, "updated_at" timestamptz NOT NULL, PRIMARY KEY ("id"));
-- create index "creator_affiliations_open" to table: "creator_affiliations"
CREATE UNIQUE INDEX "creator_affiliations_open" ON "creator_affiliations" ("creator_id", "store_id", "product_id") WHERE ((status)::text = ANY ((ARRAY['requested'::character varying, 'active'::character varying, 'paused'::character varying])::text[]));
-- create index "creatoraffiliation_store_id_status_created_at" to table: "creator_affiliations"
CREATE INDEX "creatoraffiliation_store_id_status_created_at" ON "creator_affiliations" ("store_id", "status", "created_at");
-- create "creator_earnings" table
CREATE TABLE "creator_earnings" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "creator_id" character varying NOT NULL, "kind" character varying NOT NULL, "reference" character varying NOT NULL, "source_type" character varying NOT NULL DEFAULT '', "source_id" character varying NOT NULL DEFAULT '', "description" character varying NOT NULL DEFAULT '', "gross_minor" bigint NOT NULL, "net_minor" bigint NOT NULL, "unit" character varying NOT NULL, "status" character varying NOT NULL DEFAULT 'available', "available_at" timestamptz NULL, PRIMARY KEY ("id"));
-- create index "creatorearning_creator_id_created_at" to table: "creator_earnings"
CREATE INDEX "creatorearning_creator_id_created_at" ON "creator_earnings" ("creator_id", "created_at");
-- create index "creatorearning_creator_id_kind_created_at" to table: "creator_earnings"
CREATE INDEX "creatorearning_creator_id_kind_created_at" ON "creator_earnings" ("creator_id", "kind", "created_at");
-- create index "creatorearning_reference" to table: "creator_earnings"
CREATE UNIQUE INDEX "creatorearning_reference" ON "creator_earnings" ("reference");
-- create "creator_violations" table
CREATE TABLE "creator_violations" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "user_id" character varying NOT NULL, "reason" character varying NOT NULL, "source" character varying NOT NULL DEFAULT 'staff', "recorded_by_staff_id" character varying NOT NULL DEFAULT '', PRIMARY KEY ("id"));
-- create index "creatorviolation_user_id_created_at" to table: "creator_violations"
CREATE INDEX "creatorviolation_user_id_created_at" ON "creator_violations" ("user_id", "created_at");
-- create "tip_transactions" table
CREATE TABLE "tip_transactions" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "sender_user_id" character varying NOT NULL, "creator_user_id" character varying NOT NULL, "target_type" character varying NOT NULL, "target_id" character varying NOT NULL, "coins" bigint NOT NULL, "creator_coins" bigint NOT NULL, "platform_fee_coins" bigint NOT NULL, "creator_share_bps" bigint NOT NULL, "idempotency_key" character varying NOT NULL, "request_hash" character varying NOT NULL, "ledger_entry_id" character varying NOT NULL, PRIMARY KEY ("id"));
-- create index "tiptransaction_creator_user_id_created_at" to table: "tip_transactions"
CREATE INDEX "tiptransaction_creator_user_id_created_at" ON "tip_transactions" ("creator_user_id", "created_at");
-- create index "tiptransaction_sender_user_id_idempotency_key" to table: "tip_transactions"
CREATE UNIQUE INDEX "tiptransaction_sender_user_id_idempotency_key" ON "tip_transactions" ("sender_user_id", "idempotency_key");
-- let identity read violation history for eligibility
GRANT SELECT ("user_id", "created_at") ON "creator_violations" TO nantty_readers;
