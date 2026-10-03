REVOKE SELECT ON "business_categories" FROM zudomart_readers;
REVOKE SELECT ON "profiles" FROM zudomart_readers;
DO $$ BEGIN EXECUTE format('REVOKE USAGE ON SCHEMA %I FROM zudomart_readers', current_schema()); END $$;
