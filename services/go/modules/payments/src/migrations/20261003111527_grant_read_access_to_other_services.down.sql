REVOKE SELECT ON "payment_intents" FROM nantty_readers;
REVOKE SELECT ON "order_payables" FROM nantty_readers;
DO $$ BEGIN EXECUTE format('REVOKE USAGE ON SCHEMA %I FROM nantty_readers', current_schema()); END $$;
