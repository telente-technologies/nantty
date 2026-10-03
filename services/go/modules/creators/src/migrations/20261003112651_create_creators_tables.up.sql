-- create "battle_settlements" table
CREATE TABLE "battle_settlements" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "battle_id" character varying NOT NULL, "live_id" character varying NOT NULL, "host_user_id" character varying NOT NULL, "requested_rule" character varying NOT NULL, "rule_applied" character varying NOT NULL, "winner_user_id" character varying NOT NULL DEFAULT '', "payouts" jsonb NOT NULL, "transfers" jsonb NOT NULL, "ledger_entry_id" uuid NULL, "request_hash" character varying NOT NULL, PRIMARY KEY ("id"));
-- create index "battlesettlement_battle_id" to table: "battle_settlements"
CREATE UNIQUE INDEX "battlesettlement_battle_id" ON "battle_settlements" ("battle_id");
-- create "creator_program_members" table
CREATE TABLE "creator_program_members" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "user_id" character varying NOT NULL, "tier_id" character varying NOT NULL, "status" character varying NOT NULL DEFAULT 'approved', "updated_by_staff_id" character varying NOT NULL DEFAULT '', "updated_at" timestamptz NOT NULL, PRIMARY KEY ("id"));
-- create index "creatorprogrammember_user_id" to table: "creator_program_members"
CREATE UNIQUE INDEX "creatorprogrammember_user_id" ON "creator_program_members" ("user_id");
-- create "creator_tiers" table
CREATE TABLE "creator_tiers" ("id" character varying NOT NULL, "name" character varying NOT NULL, "gift_share_bps" bigint NOT NULL, "is_default" boolean NOT NULL DEFAULT false, "updated_by_staff_id" character varying NOT NULL DEFAULT '', "updated_at" timestamptz NOT NULL, PRIMARY KEY ("id"), CONSTRAINT "creator_tiers_gift_share_capped" CHECK ((gift_share_bps >= 0) AND (gift_share_bps <= 7000)));
-- create "gift_transactions" table
CREATE TABLE "gift_transactions" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "sender_user_id" character varying NOT NULL, "receiver_user_id" character varying NOT NULL, "credited_user_id" character varying NOT NULL, "host_user_id" character varying NOT NULL, "live_id" character varying NOT NULL, "battle_id" character varying NOT NULL DEFAULT '', "gift_id" character varying NOT NULL, "combo_id" character varying NOT NULL DEFAULT '', "quantity" bigint NOT NULL, "unit_price_coins" bigint NOT NULL, "total_coins" bigint NOT NULL, "platform_fee_coins" bigint NOT NULL, "creator_amount_coins" bigint NOT NULL, "creator_share_bps" bigint NOT NULL, "status" character varying NOT NULL DEFAULT 'committed', "idempotency_key" character varying NOT NULL, "request_hash" character varying NOT NULL, "ledger_entry_id" uuid NOT NULL, PRIMARY KEY ("id"), CONSTRAINT "gift_transactions_split_sums" CHECK (((quantity >= 1) AND (quantity <= 100)) AND (unit_price_coins > 0) AND (total_coins = (platform_fee_coins + creator_amount_coins)) AND (platform_fee_coins >= 0) AND (creator_amount_coins >= 0)));
-- create index "gifttransaction_battle_id_receiver_user_id" to table: "gift_transactions"
CREATE INDEX "gifttransaction_battle_id_receiver_user_id" ON "gift_transactions" ("battle_id", "receiver_user_id");
-- create index "gifttransaction_credited_user_id_created_at" to table: "gift_transactions"
CREATE INDEX "gifttransaction_credited_user_id_created_at" ON "gift_transactions" ("credited_user_id", "created_at");
-- create index "gifttransaction_live_id_created_at" to table: "gift_transactions"
CREATE INDEX "gifttransaction_live_id_created_at" ON "gift_transactions" ("live_id", "created_at");
-- create index "gifttransaction_sender_user_id_idempotency_key" to table: "gift_transactions"
CREATE UNIQUE INDEX "gifttransaction_sender_user_id_idempotency_key" ON "gift_transactions" ("sender_user_id", "idempotency_key");
-- create "outbox_events" table
CREATE TABLE "outbox_events" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "event_type" character varying NOT NULL, "subject" character varying NOT NULL, "payload" jsonb NOT NULL, "published_at" timestamptz NULL, "attempt_count" bigint NOT NULL DEFAULT 0, "next_attempt_at" timestamptz NULL, "last_error" character varying NOT NULL DEFAULT '', "dead_lettered_at" timestamptz NULL, PRIMARY KEY ("id"));
-- create index "outboxevent_published_at_dead_lettered_at_created_at" to table: "outbox_events"
CREATE INDEX "outboxevent_published_at_dead_lettered_at_created_at" ON "outbox_events" ("published_at", "dead_lettered_at", "created_at");
