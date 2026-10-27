REVOKE SELECT ON "stores", "products", "product_variants", "categories", "brands" FROM nantty_readers;
DO $$ BEGIN EXECUTE format('REVOKE USAGE ON SCHEMA %I FROM nantty_readers', current_schema()); END $$;
