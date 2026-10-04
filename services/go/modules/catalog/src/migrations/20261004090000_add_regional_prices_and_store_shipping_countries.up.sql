-- modify "product_variants" table
ALTER TABLE "product_variants" ADD COLUMN "regional_prices" jsonb NULL;
-- modify "stores" table
ALTER TABLE "stores" ADD COLUMN "shipping_country_codes" jsonb NULL;
