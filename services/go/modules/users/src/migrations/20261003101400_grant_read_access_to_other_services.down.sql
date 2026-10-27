REVOKE SELECT ON "business_categories" FROM nantty_readers;
REVOKE SELECT ON "profiles" FROM nantty_readers;
DO $$ BEGIN EXECUTE format('REVOKE USAGE ON SCHEMA %I FROM nantty_readers', current_schema()); END $$;
