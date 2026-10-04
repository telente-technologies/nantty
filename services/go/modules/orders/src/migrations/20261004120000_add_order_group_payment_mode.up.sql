-- modify "order_groups" table
ALTER TABLE "order_groups" ADD COLUMN "payment_mode" character varying(10) NOT NULL DEFAULT 'escrow';
