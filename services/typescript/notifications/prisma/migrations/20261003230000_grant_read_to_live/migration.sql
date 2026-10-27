DO $$ BEGIN EXECUTE format('GRANT USAGE ON SCHEMA %I TO nantty_readers', current_schema()); END $$;
GRANT SELECT ("userId", "category", "push", "email") ON "notification_preferences" TO nantty_readers;
