REVOKE SELECT ON "escrows" FROM nantty_readers;
REVOKE SELECT ON "disputes" FROM nantty_readers;
DO $$ BEGIN EXECUTE format('REVOKE USAGE ON SCHEMA %I FROM nantty_readers', current_schema()); END $$;
