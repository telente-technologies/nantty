-- reverse: create index "processedgift_sender_id_created_at" to table: "processed_gifts"
DROP INDEX "processedgift_sender_id_created_at";
-- reverse: create "processed_gifts" table
DROP TABLE "processed_gifts";
-- reverse: create "points_rules" table
DROP TABLE "points_rules";
-- reverse: create index "pointsentry_user_id_source_type_created_at" to table: "points_entries"
DROP INDEX "pointsentry_user_id_source_type_created_at";
-- reverse: create index "pointsentry_type_created_at" to table: "points_entries"
DROP INDEX "pointsentry_type_created_at";
-- reverse: create index "pointsentry_live_id_user_id" to table: "points_entries"
DROP INDEX "pointsentry_live_id_user_id";
-- reverse: create index "pointsentry_country_code_type_created_at" to table: "points_entries"
DROP INDEX "pointsentry_country_code_type_created_at";
-- reverse: create index "pointsentry_category_id_type_created_at" to table: "points_entries"
DROP INDEX "pointsentry_category_id_type_created_at";
-- reverse: create index "points_entries_idempotency_key_key" to table: "points_entries"
DROP INDEX "points_entries_idempotency_key_key";
-- reverse: create "points_entries" table
DROP TABLE "points_entries";
-- reverse: create index "outboxevent_published_at_created_at" to table: "outbox_events"
DROP INDEX "outboxevent_published_at_created_at";
-- reverse: create "outbox_events" table
DROP TABLE "outbox_events";
-- reverse: create index "liveviewer_live_id_user_id" to table: "live_viewers"
DROP INDEX "liveviewer_live_id_user_id";
-- reverse: create index "liveviewer_live_id_left_at" to table: "live_viewers"
DROP INDEX "liveviewer_live_id_left_at";
-- reverse: create "live_viewers" table
DROP TABLE "live_viewers";
-- reverse: create index "livesession_state_created_at" to table: "live_sessions"
DROP INDEX "livesession_state_created_at";
-- reverse: create index "livesession_host_id_state" to table: "live_sessions"
DROP INDEX "livesession_host_id_state";
-- reverse: create "live_sessions" table
DROP TABLE "live_sessions";
-- reverse: create index "liveproduct_live_id_product_id" to table: "live_products"
DROP INDEX "liveproduct_live_id_product_id";
-- reverse: create "live_products" table
DROP TABLE "live_products";
-- reverse: create index "liveleaderboardentry_live_id_user_id" to table: "live_leaderboard_entries"
DROP INDEX "liveleaderboardentry_live_id_user_id";
-- reverse: create index "liveleaderboardentry_live_id_rank" to table: "live_leaderboard_entries"
DROP INDEX "liveleaderboardentry_live_id_rank";
-- reverse: create "live_leaderboard_entries" table
DROP TABLE "live_leaderboard_entries";
-- reverse: create index "joinrequest_live_id_user_id" to table: "join_requests"
DROP INDEX "joinrequest_live_id_user_id";
-- reverse: create index "joinrequest_live_id_state" to table: "join_requests"
DROP INDEX "joinrequest_live_id_state";
-- reverse: create "join_requests" table
DROP TABLE "join_requests";
-- reverse: create index "guestslot_state_state_deadline_at" to table: "guest_slots"
DROP INDEX "guestslot_state_state_deadline_at";
-- reverse: create index "guestslot_state_expires_at" to table: "guest_slots"
DROP INDEX "guestslot_state_expires_at";
-- reverse: create index "guestslot_live_id_user_id" to table: "guest_slots"
DROP INDEX "guestslot_live_id_user_id";
-- reverse: create index "guestslot_live_id_state" to table: "guest_slots"
DROP INDEX "guestslot_live_id_state";
-- reverse: create "guest_slots" table
DROP TABLE "guest_slots";
-- reverse: create index "goalcontribution_goal_id_sender_id" to table: "goal_contributions"
DROP INDEX "goalcontribution_goal_id_sender_id";
-- reverse: create "goal_contributions" table
DROP TABLE "goal_contributions";
-- reverse: create index "giftgoal_live_id_status" to table: "gift_goals"
DROP INDEX "giftgoal_live_id_status";
-- reverse: create "gift_goals" table
DROP TABLE "gift_goals";
-- reverse: create index "giftcontribution_live_id_scope_key_sender_id" to table: "gift_contributions"
DROP INDEX "giftcontribution_live_id_scope_key_sender_id";
-- reverse: create index "giftcontribution_live_id_scope_key_receiver_id_sender_id" to table: "gift_contributions"
DROP INDEX "giftcontribution_live_id_scope_key_receiver_id_sender_id";
-- reverse: create "gift_contributions" table
DROP TABLE "gift_contributions";
-- reverse: create index "giftcombo_sender_id_live_id_combo_id" to table: "gift_combos"
DROP INDEX "giftcombo_sender_id_live_id_combo_id";
-- reverse: create "gift_combos" table
DROP TABLE "gift_combos";
-- reverse: create index "gift_is_active_sort_order" to table: "gifts"
DROP INDEX "gift_is_active_sort_order";
-- reverse: create "gifts" table
DROP TABLE "gifts";
-- reverse: create index "battleparticipant_user_id_state" to table: "battle_participants"
DROP INDEX "battleparticipant_user_id_state";
-- reverse: create index "battleparticipant_battle_id_user_id" to table: "battle_participants"
DROP INDEX "battleparticipant_battle_id_user_id";
-- reverse: create "battle_participants" table
DROP TABLE "battle_participants";
-- reverse: create index "battlegiftevent_battle_id_created_at" to table: "battle_gift_events"
DROP INDEX "battlegiftevent_battle_id_created_at";
-- reverse: create "battle_gift_events" table
DROP TABLE "battle_gift_events";
-- reverse: create index "battle_state_starts_at" to table: "battles"
DROP INDEX "battle_state_starts_at";
-- reverse: create index "battle_state_proposal_expires_at" to table: "battles"
DROP INDEX "battle_state_proposal_expires_at";
-- reverse: create index "battle_state_ends_at" to table: "battles"
DROP INDEX "battle_state_ends_at";
-- reverse: create index "battle_live_id_idempotency_key" to table: "battles"
DROP INDEX "battle_live_id_idempotency_key";
-- reverse: create index "battle_live_id" to table: "battles"
DROP INDEX "battle_live_id";
-- reverse: create "battles" table
DROP TABLE "battles";
