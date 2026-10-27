DO $$ BEGIN EXECUTE format('GRANT USAGE ON SCHEMA %I TO nantty_readers', current_schema()); END $$;
GRANT SELECT ("id", "host_id", "title", "category", "state", "started_at", "ended_at", "peak_viewers", "host_is_creator", "store_id", "created_at") ON "live_sessions" TO nantty_readers;
GRANT SELECT ("id", "name", "tier", "price_coins", "display_level", "is_active") ON "gifts" TO nantty_readers;
GRANT SELECT ("id", "live_id", "state", "winner_takes_all", "starts_at", "ends_at", "settled_at", "created_at") ON "battles" TO nantty_readers;
GRANT SELECT ("id", "user_id", "type", "amount", "source_type", "live_id", "category_id", "country_code", "created_at") ON "points_entries" TO nantty_readers;
