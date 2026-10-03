GRANT SELECT ON "geo_countries", "geo_regions", "geo_admin_areas", "geo_cities", "policy_versions" TO zudomart_readers;
GRANT SELECT ("account_id", "analytics", "personalization", "personalized_ads", "marketing", "policy_version", "updated_at") ON "privacy_settings" TO zudomart_readers;
