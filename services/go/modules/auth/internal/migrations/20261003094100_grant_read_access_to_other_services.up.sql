DO $$ BEGIN EXECUTE format('GRANT USAGE ON SCHEMA %I TO zudomart_readers', current_schema()); END $$;
GRANT SELECT ("id", "username", "name", "email", "status", "created_at") ON "accounts" TO zudomart_readers;
