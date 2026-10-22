-- modify "order_groups" table
ALTER TABLE "order_groups" ADD COLUMN "seller_name" character varying NOT NULL DEFAULT '';
