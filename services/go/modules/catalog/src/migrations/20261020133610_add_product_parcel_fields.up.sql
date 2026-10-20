-- modify "product_variants" table
ALTER TABLE "product_variants" ADD COLUMN "weight_grams" bigint NULL, ADD COLUMN "length_mm" bigint NULL, ADD COLUMN "width_mm" bigint NULL, ADD COLUMN "height_mm" bigint NULL;
-- modify "products" table
ALTER TABLE "products" ADD COLUMN "weight_grams" bigint NULL, ADD COLUMN "length_mm" bigint NULL, ADD COLUMN "width_mm" bigint NULL, ADD COLUMN "height_mm" bigint NULL, ADD COLUMN "package_category" character varying NOT NULL DEFAULT 'general', ADD COLUMN "package_count" bigint NOT NULL DEFAULT 1, ADD COLUMN "fragile" boolean NOT NULL DEFAULT false, ADD COLUMN "contents_description" character varying NOT NULL DEFAULT '', ADD COLUMN "declared_value_minor" bigint NULL;
