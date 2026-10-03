REVOKE SELECT ON "stores", "products", "product_variants", "categories", "brands" FROM zudomart_readers;
DO $$ BEGIN EXECUTE format('REVOKE USAGE ON SCHEMA %I FROM zudomart_readers', current_schema()); END $$;
