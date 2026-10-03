-- create "battles" table
CREATE TABLE "battles" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "live_id" uuid NOT NULL, "host_id" uuid NOT NULL, "state" character varying NOT NULL DEFAULT 'pending', "winner_takes_all" boolean NOT NULL DEFAULT false, "duration_seconds" bigint NOT NULL, "idempotency_key" character varying NOT NULL, "proposal_expires_at" timestamptz NULL, "host_decision_deadline_at" timestamptz NULL, "countdown_started_at" timestamptz NULL, "starts_at" timestamptz NULL, "ends_at" timestamptz NULL, "end_reason" character varying NULL, "settled_at" timestamptz NULL, "winner_user_ids" jsonb NOT NULL, "is_tie" boolean NOT NULL DEFAULT false, "settlement" jsonb NULL, PRIMARY KEY ("id"));
-- create index "battle_live_id" to table: "battles"
CREATE UNIQUE INDEX "battle_live_id" ON "battles" ("live_id") WHERE ((state)::text = ANY ((ARRAY['pending'::character varying, 'countdown'::character varying, 'active'::character varying, 'ended'::character varying])::text[]));
-- create index "battle_live_id_idempotency_key" to table: "battles"
CREATE UNIQUE INDEX "battle_live_id_idempotency_key" ON "battles" ("live_id", "idempotency_key");
-- create index "battle_state_ends_at" to table: "battles"
CREATE INDEX "battle_state_ends_at" ON "battles" ("state", "ends_at");
-- create index "battle_state_proposal_expires_at" to table: "battles"
CREATE INDEX "battle_state_proposal_expires_at" ON "battles" ("state", "proposal_expires_at");
-- create index "battle_state_starts_at" to table: "battles"
CREATE INDEX "battle_state_starts_at" ON "battles" ("state", "starts_at");
-- create "battle_gift_events" table
CREATE TABLE "battle_gift_events" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "battle_id" uuid NOT NULL, "sender_id" uuid NOT NULL, "receiver_id" uuid NOT NULL, "gift_id" character varying NOT NULL, "coins" bigint NOT NULL, PRIMARY KEY ("id"));
-- create index "battlegiftevent_battle_id_created_at" to table: "battle_gift_events"
CREATE INDEX "battlegiftevent_battle_id_created_at" ON "battle_gift_events" ("battle_id", "created_at");
-- create "battle_participants" table
CREATE TABLE "battle_participants" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "battle_id" uuid NOT NULL, "user_id" uuid NOT NULL, "state" character varying NOT NULL DEFAULT 'active', "consent" character varying NOT NULL DEFAULT 'accepted', "score" bigint NOT NULL DEFAULT 0, "is_creator_program_member" boolean NOT NULL DEFAULT false, "removed_by_host" boolean NOT NULL DEFAULT false, PRIMARY KEY ("id"));
-- create index "battleparticipant_battle_id_user_id" to table: "battle_participants"
CREATE UNIQUE INDEX "battleparticipant_battle_id_user_id" ON "battle_participants" ("battle_id", "user_id");
-- create index "battleparticipant_user_id_state" to table: "battle_participants"
CREATE INDEX "battleparticipant_user_id_state" ON "battle_participants" ("user_id", "state");
-- create "gifts" table
CREATE TABLE "gifts" ("id" character varying NOT NULL, "name" character varying NOT NULL, "description" character varying NULL, "tier" character varying NOT NULL, "price_coins" bigint NOT NULL, "animation_engine" character varying NOT NULL DEFAULT 'lottie', "animation_asset_key" character varying NOT NULL, "preview_asset_key" character varying NOT NULL, "duration_ms" bigint NOT NULL, "display_level" character varying NOT NULL, "sound" character varying NULL, "haptic" character varying NULL, "comboable" boolean NOT NULL DEFAULT false, "is_active" boolean NOT NULL DEFAULT true, "sort_order" bigint NOT NULL DEFAULT 0, "metadata" jsonb NULL, "created_at" timestamptz NOT NULL, "updated_at" timestamptz NOT NULL, PRIMARY KEY ("id"));
-- create index "gift_is_active_sort_order" to table: "gifts"
CREATE INDEX "gift_is_active_sort_order" ON "gifts" ("is_active", "sort_order");
-- create "gift_combos" table
CREATE TABLE "gift_combos" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "sender_id" uuid NOT NULL, "live_id" uuid NOT NULL, "combo_id" character varying NOT NULL, "gift_id" character varying NOT NULL, "receiver_id" uuid NOT NULL, "count" bigint NOT NULL DEFAULT 0, "last_idempotency_key" character varying NOT NULL, "last_at" timestamptz NOT NULL, PRIMARY KEY ("id"));
-- create index "giftcombo_sender_id_live_id_combo_id" to table: "gift_combos"
CREATE UNIQUE INDEX "giftcombo_sender_id_live_id_combo_id" ON "gift_combos" ("sender_id", "live_id", "combo_id");
-- create "gift_contributions" table
CREATE TABLE "gift_contributions" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "live_id" uuid NOT NULL, "scope_key" character varying NOT NULL, "receiver_id" uuid NOT NULL, "sender_id" uuid NOT NULL, "coins" bigint NOT NULL DEFAULT 0, "gift_count" bigint NOT NULL DEFAULT 0, PRIMARY KEY ("id"));
-- create index "giftcontribution_live_id_scope_key_receiver_id_sender_id" to table: "gift_contributions"
CREATE UNIQUE INDEX "giftcontribution_live_id_scope_key_receiver_id_sender_id" ON "gift_contributions" ("live_id", "scope_key", "receiver_id", "sender_id");
-- create index "giftcontribution_live_id_scope_key_sender_id" to table: "gift_contributions"
CREATE INDEX "giftcontribution_live_id_scope_key_sender_id" ON "gift_contributions" ("live_id", "scope_key", "sender_id");
-- create "gift_goals" table
CREATE TABLE "gift_goals" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "live_id" uuid NOT NULL, "creator_id" uuid NOT NULL, "title" character varying NOT NULL, "target_coins" bigint NOT NULL, "gift_id" character varying NULL, "progress_coins" bigint NOT NULL DEFAULT 0, "status" character varying NOT NULL DEFAULT 'active', "completed_at" timestamptz NULL, PRIMARY KEY ("id"));
-- create index "giftgoal_live_id_status" to table: "gift_goals"
CREATE INDEX "giftgoal_live_id_status" ON "gift_goals" ("live_id", "status");
-- create "goal_contributions" table
CREATE TABLE "goal_contributions" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "goal_id" uuid NOT NULL, "sender_id" uuid NOT NULL, "coins" bigint NOT NULL DEFAULT 0, PRIMARY KEY ("id"));
-- create index "goalcontribution_goal_id_sender_id" to table: "goal_contributions"
CREATE UNIQUE INDEX "goalcontribution_goal_id_sender_id" ON "goal_contributions" ("goal_id", "sender_id");
-- create "guest_slots" table
CREATE TABLE "guest_slots" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "live_id" uuid NOT NULL, "user_id" uuid NOT NULL, "role" character varying NOT NULL DEFAULT 'guest', "state" character varying NOT NULL DEFAULT 'invited', "expires_at" timestamptz NOT NULL, "state_deadline_at" timestamptz NULL, "joined_at" timestamptz NULL, "left_at" timestamptz NULL, "audio_muted_by_host" boolean NOT NULL DEFAULT false, "video_muted_by_host" boolean NOT NULL DEFAULT false, "audio_muted_by_self" boolean NOT NULL DEFAULT false, "video_muted_by_self" boolean NOT NULL DEFAULT false, "end_reason" character varying NULL, PRIMARY KEY ("id"));
-- create index "guestslot_live_id_state" to table: "guest_slots"
CREATE INDEX "guestslot_live_id_state" ON "guest_slots" ("live_id", "state");
-- create index "guestslot_live_id_user_id" to table: "guest_slots"
CREATE UNIQUE INDEX "guestslot_live_id_user_id" ON "guest_slots" ("live_id", "user_id") WHERE ((state)::text = ANY ((ARRAY['invited'::character varying, 'joining'::character varying, 'onStage'::character varying, 'reconnecting'::character varying])::text[]));
-- create index "guestslot_state_expires_at" to table: "guest_slots"
CREATE INDEX "guestslot_state_expires_at" ON "guest_slots" ("state", "expires_at");
-- create index "guestslot_state_state_deadline_at" to table: "guest_slots"
CREATE INDEX "guestslot_state_state_deadline_at" ON "guest_slots" ("state", "state_deadline_at");
-- create "join_requests" table
CREATE TABLE "join_requests" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "live_id" uuid NOT NULL, "user_id" uuid NOT NULL, "state" character varying NOT NULL DEFAULT 'pending', "decided_at" timestamptz NULL, PRIMARY KEY ("id"));
-- create index "joinrequest_live_id_state" to table: "join_requests"
CREATE INDEX "joinrequest_live_id_state" ON "join_requests" ("live_id", "state");
-- create index "joinrequest_live_id_user_id" to table: "join_requests"
CREATE UNIQUE INDEX "joinrequest_live_id_user_id" ON "join_requests" ("live_id", "user_id") WHERE ((state)::text = 'pending'::text);
-- create "live_leaderboard_entries" table
CREATE TABLE "live_leaderboard_entries" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "live_id" uuid NOT NULL, "user_id" uuid NOT NULL, "rank" bigint NOT NULL, "coins" bigint NOT NULL DEFAULT 0, "points" bigint NOT NULL DEFAULT 0, PRIMARY KEY ("id"));
-- create index "liveleaderboardentry_live_id_rank" to table: "live_leaderboard_entries"
CREATE INDEX "liveleaderboardentry_live_id_rank" ON "live_leaderboard_entries" ("live_id", "rank");
-- create index "liveleaderboardentry_live_id_user_id" to table: "live_leaderboard_entries"
CREATE UNIQUE INDEX "liveleaderboardentry_live_id_user_id" ON "live_leaderboard_entries" ("live_id", "user_id");
-- create "live_products" table
CREATE TABLE "live_products" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "live_id" uuid NOT NULL, "product_id" uuid NOT NULL, "pinned" boolean NOT NULL DEFAULT false, "pinned_at" timestamptz NULL, PRIMARY KEY ("id"));
-- create index "liveproduct_live_id_product_id" to table: "live_products"
CREATE UNIQUE INDEX "liveproduct_live_id_product_id" ON "live_products" ("live_id", "product_id");
-- create "live_sessions" table
CREATE TABLE "live_sessions" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "host_id" uuid NOT NULL, "title" character varying NOT NULL, "category" character varying NOT NULL DEFAULT 'justChatting', "visibility" character varying NOT NULL DEFAULT 'public', "state" character varying NOT NULL DEFAULT 'idle', "started_at" timestamptz NULL, "ended_at" timestamptz NULL, "viewers" bigint NOT NULL DEFAULT 0, "peak_viewers" bigint NOT NULL DEFAULT 0, "cover_url" character varying NULL, "gifts_enabled" boolean NOT NULL DEFAULT true, "host_is_creator" boolean NOT NULL DEFAULT false, "store_id" uuid NULL, "pinned_product_id" uuid NULL, "livekit_room" character varying NOT NULL, "country_code" character varying NOT NULL DEFAULT '', "top_supporter_user_id" uuid NULL, "gift_count" bigint NOT NULL DEFAULT 0, "total_coins" bigint NOT NULL DEFAULT 0, "creator_coins" bigint NOT NULL DEFAULT 0, "live_ad_settings" jsonb NULL, "accepted_live_ad_terms_version" character varying NULL, "accepted_live_ad_terms_at" timestamptz NULL, "sponsorship_line" character varying NULL, "updated_at" timestamptz NOT NULL, PRIMARY KEY ("id"));
-- create index "livesession_host_id_state" to table: "live_sessions"
CREATE INDEX "livesession_host_id_state" ON "live_sessions" ("host_id", "state");
-- create index "livesession_state_created_at" to table: "live_sessions"
CREATE INDEX "livesession_state_created_at" ON "live_sessions" ("state", "created_at");
-- create "live_viewers" table
CREATE TABLE "live_viewers" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "live_id" uuid NOT NULL, "user_id" uuid NOT NULL, "last_seen_at" timestamptz NOT NULL, "left_at" timestamptz NULL, PRIMARY KEY ("id"));
-- create index "liveviewer_live_id_left_at" to table: "live_viewers"
CREATE INDEX "liveviewer_live_id_left_at" ON "live_viewers" ("live_id", "left_at");
-- create index "liveviewer_live_id_user_id" to table: "live_viewers"
CREATE UNIQUE INDEX "liveviewer_live_id_user_id" ON "live_viewers" ("live_id", "user_id");
-- create "outbox_events" table
CREATE TABLE "outbox_events" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "event_type" character varying NOT NULL, "subject" character varying NOT NULL, "payload" jsonb NOT NULL, "published_at" timestamptz NULL, PRIMARY KEY ("id"));
-- create index "outboxevent_published_at_created_at" to table: "outbox_events"
CREATE INDEX "outboxevent_published_at_created_at" ON "outbox_events" ("published_at", "created_at");
-- create "points_entries" table
CREATE TABLE "points_entries" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "user_id" uuid NOT NULL, "type" character varying NOT NULL, "amount" bigint NOT NULL, "source_type" character varying NOT NULL, "source_id" character varying NOT NULL DEFAULT '', "live_id" uuid NULL, "host_user_id" uuid NULL, "category_id" character varying NOT NULL DEFAULT '', "country_code" character varying NOT NULL DEFAULT '', "host_is_creator" boolean NOT NULL DEFAULT false, "idempotency_key" character varying NOT NULL, PRIMARY KEY ("id"));
-- create index "points_entries_idempotency_key_key" to table: "points_entries"
CREATE UNIQUE INDEX "points_entries_idempotency_key_key" ON "points_entries" ("idempotency_key");
-- create index "pointsentry_category_id_type_created_at" to table: "points_entries"
CREATE INDEX "pointsentry_category_id_type_created_at" ON "points_entries" ("category_id", "type", "created_at");
-- create index "pointsentry_country_code_type_created_at" to table: "points_entries"
CREATE INDEX "pointsentry_country_code_type_created_at" ON "points_entries" ("country_code", "type", "created_at");
-- create index "pointsentry_live_id_user_id" to table: "points_entries"
CREATE INDEX "pointsentry_live_id_user_id" ON "points_entries" ("live_id", "user_id");
-- create index "pointsentry_type_created_at" to table: "points_entries"
CREATE INDEX "pointsentry_type_created_at" ON "points_entries" ("type", "created_at");
-- create index "pointsentry_user_id_source_type_created_at" to table: "points_entries"
CREATE INDEX "pointsentry_user_id_source_type_created_at" ON "points_entries" ("user_id", "source_type", "created_at");
-- create "points_rules" table
CREATE TABLE "points_rules" ("id" character varying NOT NULL, "points" bigint NOT NULL, "per_minute_cap" bigint NOT NULL DEFAULT 0, "per_day_cap" bigint NOT NULL DEFAULT 0, "per_live_cap" bigint NOT NULL DEFAULT 0, "active" boolean NOT NULL DEFAULT true, PRIMARY KEY ("id"));
-- create "processed_gifts" table
CREATE TABLE "processed_gifts" ("id" uuid NOT NULL, "sender_id" uuid NOT NULL, "created_at" timestamptz NOT NULL, PRIMARY KEY ("id"));
-- create index "processedgift_sender_id_created_at" to table: "processed_gifts"
CREATE INDEX "processedgift_sender_id_created_at" ON "processed_gifts" ("sender_id", "created_at");
