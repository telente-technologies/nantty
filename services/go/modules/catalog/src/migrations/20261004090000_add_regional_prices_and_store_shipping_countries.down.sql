-- reverse: modify "stores" table
ALTER TABLE "stores" DROP COLUMN "shipping_country_codes";
-- reverse: modify "product_variants" table
ALTER TABLE "product_variants" DROP COLUMN "regional_prices";
