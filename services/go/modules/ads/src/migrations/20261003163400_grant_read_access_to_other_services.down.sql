REVOKE SELECT ON "ad_stats_dailies", "ad_creator_earnings", "ad_content_signals" FROM zudomart_readers;
DO $$ BEGIN EXECUTE format('REVOKE USAGE ON SCHEMA %I FROM zudomart_readers', current_schema()); END $$;
