-- modify "products" table
ALTER TABLE "products" ADD COLUMN "moderation_visibility_at" timestamptz NULL;
-- modify "stores" table
ALTER TABLE "stores" ADD COLUMN "moderation_visibility_at" timestamptz NULL;
