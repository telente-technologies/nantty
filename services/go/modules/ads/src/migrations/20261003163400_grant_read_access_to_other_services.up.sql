DO $$ BEGIN EXECUTE format('GRANT USAGE ON SCHEMA %I TO zudomart_readers', current_schema()); END $$;
GRANT SELECT ("day", "account_id", "campaign_id", "ad_group_id", "ad_id", "placement", "impressions", "qualified_impressions", "clicks", "spend_micros", "conversions", "conversion_value_minor") ON "ad_stats_dailies" TO zudomart_readers;
GRANT SELECT ("creator_user_id", "currency", "accrued_micros", "posted_minor", "qualified_impressions") ON "ad_creator_earnings" TO zudomart_readers;
GRANT SELECT ("content_id", "creator_user_id", "monetization_eligible") ON "ad_content_signals" TO zudomart_readers;
