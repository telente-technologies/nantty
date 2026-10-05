-- reverse: modify "shipping_addresses" table
ALTER TABLE "shipping_addresses" DROP COLUMN "phone_sealed", ALTER COLUMN "phone" DROP DEFAULT;
