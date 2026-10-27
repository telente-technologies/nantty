REVOKE SELECT ON "creator_program_members" FROM nantty_readers;
REVOKE SELECT ON "gift_transactions" FROM nantty_readers;
REVOKE SELECT ON "battle_settlements" FROM nantty_readers;
DO $$ BEGIN EXECUTE format('REVOKE USAGE ON SCHEMA %I FROM nantty_readers', current_schema()); END $$;
