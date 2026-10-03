-- reverse: create index "outboxevent_published_at_dead_lettered_at_created_at" to table: "outbox_events"
DROP INDEX "outboxevent_published_at_dead_lettered_at_created_at";
-- reverse: create "outbox_events" table
DROP TABLE "outbox_events";
-- reverse: create index "gifttransaction_sender_user_id_idempotency_key" to table: "gift_transactions"
DROP INDEX "gifttransaction_sender_user_id_idempotency_key";
-- reverse: create index "gifttransaction_live_id_created_at" to table: "gift_transactions"
DROP INDEX "gifttransaction_live_id_created_at";
-- reverse: create index "gifttransaction_credited_user_id_created_at" to table: "gift_transactions"
DROP INDEX "gifttransaction_credited_user_id_created_at";
-- reverse: create index "gifttransaction_battle_id_receiver_user_id" to table: "gift_transactions"
DROP INDEX "gifttransaction_battle_id_receiver_user_id";
-- reverse: create "gift_transactions" table
DROP TABLE "gift_transactions";
-- reverse: create "creator_tiers" table
DROP TABLE "creator_tiers";
-- reverse: create index "creatorprogrammember_user_id" to table: "creator_program_members"
DROP INDEX "creatorprogrammember_user_id";
-- reverse: create "creator_program_members" table
DROP TABLE "creator_program_members";
-- reverse: create index "battlesettlement_battle_id" to table: "battle_settlements"
DROP INDEX "battlesettlement_battle_id";
-- reverse: create "battle_settlements" table
DROP TABLE "battle_settlements";
