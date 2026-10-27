DO $$ BEGIN EXECUTE format('GRANT USAGE ON SCHEMA %I TO nantty_readers', current_schema()); END $$;
GRANT SELECT ("id", "account_id", "kind", "handle", "display_name", "avatar_url", "avatar_media_key", "is_private", "verified", "status", "country_code") ON "profiles" TO nantty_readers;
GRANT SELECT ON "business_categories" TO nantty_readers;
