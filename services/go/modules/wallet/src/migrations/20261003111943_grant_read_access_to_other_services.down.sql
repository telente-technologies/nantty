REVOKE SELECT ON "coin_packages" FROM nantty_readers;
REVOKE SELECT ON "withdrawals" FROM nantty_readers;
DO $$ BEGIN EXECUTE format('REVOKE USAGE ON SCHEMA %I FROM nantty_readers', current_schema()); END $$;
