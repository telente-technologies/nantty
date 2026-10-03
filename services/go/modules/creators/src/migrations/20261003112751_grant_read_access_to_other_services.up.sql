DO $$ BEGIN EXECUTE format('GRANT USAGE ON SCHEMA %I TO zudomart_readers', current_schema()); END $$;
GRANT SELECT ("user_id", "tier_id", "status") ON "creator_program_members" TO zudomart_readers;
GRANT SELECT ("id", "sender_user_id", "receiver_user_id", "live_id", "battle_id", "gift_id", "quantity", "total_coins", "status", "created_at") ON "gift_transactions" TO zudomart_readers;
GRANT SELECT ("battle_id", "rule_applied", "winner_user_id", "created_at") ON "battle_settlements" TO zudomart_readers;
