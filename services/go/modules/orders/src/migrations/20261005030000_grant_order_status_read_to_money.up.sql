DO $$ BEGIN EXECUTE format('GRANT USAGE ON SCHEMA %I TO nantty_readers', current_schema()); END $$;
GRANT SELECT ("id", "status") ON "order_groups" TO nantty_readers;
