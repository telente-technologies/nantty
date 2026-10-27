DO $$ BEGIN EXECUTE format('GRANT USAGE ON SCHEMA %I TO nantty_readers', current_schema()); END $$;
GRANT SELECT ("product_id", "on_hand", "reserved", "listed") ON "stock_levels" TO nantty_readers;
