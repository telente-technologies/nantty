DO $$ BEGIN EXECUTE format('GRANT USAGE ON SCHEMA %I TO zudomart_readers', current_schema()); END $$;
GRANT SELECT ("id", "owner_account_id", "business_profile_id", "name", "slug", "logo_url", "country_code", "currency", "status", "verified", "created_at") ON "stores" TO zudomart_readers;
GRANT SELECT ("id", "store_id", "name", "category_id", "brand_id", "status", "visibility", "published_online", "currency", "min_price_minor", "published_at", "created_at") ON "products" TO zudomart_readers;
GRANT SELECT ("id", "product_id", "store_id", "title", "sku", "price_minor") ON "product_variants" TO zudomart_readers;
GRANT SELECT ON "categories", "brands" TO zudomart_readers;
