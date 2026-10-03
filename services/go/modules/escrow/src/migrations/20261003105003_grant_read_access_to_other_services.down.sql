REVOKE SELECT ON "escrows" FROM zudomart_readers;
REVOKE SELECT ON "disputes" FROM zudomart_readers;
DO $$ BEGIN EXECUTE format('REVOKE USAGE ON SCHEMA %I FROM zudomart_readers', current_schema()); END $$;
