DO $$ BEGIN EXECUTE format('GRANT USAGE ON SCHEMA %I TO nantty_readers', current_schema()); END $$;
GRANT SELECT ("id", "reference", "purpose", "subject_id", "provider", "amount_minor", "currency", "status", "paid_at", "created_at") ON "payment_intents" TO nantty_readers;
GRANT SELECT ("id", "checkout_id", "order_id", "amount_minor", "currency") ON "order_payables" TO nantty_readers;
