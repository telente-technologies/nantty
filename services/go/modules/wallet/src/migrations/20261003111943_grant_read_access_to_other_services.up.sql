DO $$ BEGIN EXECUTE format('GRANT USAGE ON SCHEMA %I TO zudomart_readers', current_schema()); END $$;
GRANT SELECT ("id", "name", "coins", "bonus_coins", "purchase_channel", "prices", "store_product_id", "active", "sort_order") ON "coin_packages" TO zudomart_readers;
GRANT SELECT ("id", "user_id", "status", "amount_minor", "currency", "created_at", "processed_at") ON "withdrawals" TO zudomart_readers;
