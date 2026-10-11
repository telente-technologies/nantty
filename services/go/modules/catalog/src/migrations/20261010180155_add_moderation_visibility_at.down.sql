-- reverse: modify "stores" table
ALTER TABLE "stores" DROP COLUMN "moderation_visibility_at";
-- reverse: modify "products" table
ALTER TABLE "products" DROP COLUMN "moderation_visibility_at";
