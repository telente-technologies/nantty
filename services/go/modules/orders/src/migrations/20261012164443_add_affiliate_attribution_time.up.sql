-- modify "cart_items" table
ALTER TABLE "cart_items" ADD COLUMN "attributed_at" timestamptz NULL;
-- modify "order_items" table
ALTER TABLE "order_items" ADD COLUMN "attributed_at" timestamptz NULL;
