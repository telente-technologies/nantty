DO $$ BEGIN EXECUTE format('GRANT USAGE ON SCHEMA %I TO nantty_readers', current_schema()); END $$;
GRANT SELECT ("followerId", "followeeId", "state") ON "follows" TO nantty_readers;
GRANT SELECT ("blockerId", "blockedId") ON "blocks" TO nantty_readers;
