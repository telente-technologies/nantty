DO $$ BEGIN EXECUTE format('GRANT USAGE ON SCHEMA %I TO zudomart_readers', current_schema()); END $$;
GRANT SELECT ("product_id", "on_hand", "reserved", "listed") ON "stock_levels" TO zudomart_readers;
