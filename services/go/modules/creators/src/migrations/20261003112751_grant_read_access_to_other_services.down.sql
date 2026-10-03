REVOKE SELECT ON "creator_program_members" FROM zudomart_readers;
REVOKE SELECT ON "gift_transactions" FROM zudomart_readers;
REVOKE SELECT ON "battle_settlements" FROM zudomart_readers;
DO $$ BEGIN EXECUTE format('REVOKE USAGE ON SCHEMA %I FROM zudomart_readers', current_schema()); END $$;
