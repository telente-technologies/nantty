-- reverse: modify "products" table
ALTER TABLE "products" DROP COLUMN "declared_value_minor", DROP COLUMN "contents_description", DROP COLUMN "fragile", DROP COLUMN "package_count", DROP COLUMN "package_category", DROP COLUMN "height_mm", DROP COLUMN "width_mm", DROP COLUMN "length_mm", DROP COLUMN "weight_grams";
-- reverse: modify "product_variants" table
ALTER TABLE "product_variants" DROP COLUMN "height_mm", DROP COLUMN "width_mm", DROP COLUMN "length_mm", DROP COLUMN "weight_grams";
