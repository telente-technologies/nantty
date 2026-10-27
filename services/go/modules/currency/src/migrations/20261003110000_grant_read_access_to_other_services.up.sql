DO $$ BEGIN EXECUTE format('GRANT USAGE ON SCHEMA %I TO nantty_readers', current_schema()); END $$;
GRANT SELECT ON "exchange_rate_revisions" TO nantty_readers;
