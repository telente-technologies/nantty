REVOKE SELECT ON "ad_stats_dailies", "ad_creator_earnings", "ad_content_signals" FROM nantty_readers;
DO $$ BEGIN EXECUTE format('REVOKE USAGE ON SCHEMA %I FROM nantty_readers', current_schema()); END $$;
