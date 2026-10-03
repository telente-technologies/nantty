REVOKE SELECT ON "coin_packages" FROM zudomart_readers;
REVOKE SELECT ON "withdrawals" FROM zudomart_readers;
DO $$ BEGIN EXECUTE format('REVOKE USAGE ON SCHEMA %I FROM zudomart_readers', current_schema()); END $$;
