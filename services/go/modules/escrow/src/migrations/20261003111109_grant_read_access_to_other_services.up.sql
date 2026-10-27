DO $$ BEGIN EXECUTE format('GRANT USAGE ON SCHEMA %I TO nantty_readers', current_schema()); END $$;
GRANT SELECT ("id", "order_id", "status", "amount_minor", "currency", "auto_release_at", "released_at", "refunded_at", "delivered_at") ON "escrows" TO nantty_readers;
GRANT SELECT ("id", "escrow_id", "order_id", "status", "created_at", "resolved_at") ON "disputes" TO nantty_readers;
