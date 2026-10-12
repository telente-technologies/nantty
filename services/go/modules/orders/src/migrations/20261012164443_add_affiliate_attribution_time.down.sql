-- reverse: modify "order_items" table
ALTER TABLE "order_items" DROP COLUMN "attributed_at";
-- reverse: modify "cart_items" table
ALTER TABLE "cart_items" DROP COLUMN "attributed_at";
