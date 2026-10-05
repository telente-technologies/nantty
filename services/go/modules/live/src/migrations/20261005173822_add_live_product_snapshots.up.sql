-- modify "live_products" table
ALTER TABLE "live_products" ADD COLUMN "title" character varying NULL, ADD COLUMN "price_minor" bigint NULL, ADD COLUMN "currency" character varying NULL, ADD COLUMN "image_url" character varying NULL;
