DO $$ BEGIN EXECUTE format('GRANT USAGE ON SCHEMA %I TO zudomart_readers', current_schema()); END $$;
GRANT SELECT ("id", "status") ON "order_groups" TO zudomart_readers;
