DO $$ BEGIN EXECUTE format('GRANT USAGE ON SCHEMA %I TO zudomart_readers', current_schema()); END $$;
GRANT SELECT ("followerId", "followeeId", "state") ON "follows" TO zudomart_readers;
GRANT SELECT ("blockerId", "blockedId") ON "blocks" TO zudomart_readers;
