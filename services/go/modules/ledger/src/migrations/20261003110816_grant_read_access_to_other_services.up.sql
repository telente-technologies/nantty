DO $$ BEGIN EXECUTE format('GRANT USAGE ON SCHEMA %I TO nantty_readers', current_schema()); END $$;
GRANT SELECT ("id", "code", "currency", "kind", "owner_type", "owner_id", "balance_minor", "updated_at") ON "ledger_accounts" TO nantty_readers;
