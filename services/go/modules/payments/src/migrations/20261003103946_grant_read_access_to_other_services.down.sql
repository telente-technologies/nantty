REVOKE SELECT ON "payment_intents" FROM zudomart_readers;
REVOKE SELECT ON "order_payables" FROM zudomart_readers;
DO $$ BEGIN EXECUTE format('REVOKE USAGE ON SCHEMA %I FROM zudomart_readers', current_schema()); END $$;
